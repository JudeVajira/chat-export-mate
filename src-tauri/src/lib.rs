use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const LATEST_RELEASE_URL: &str =
    "https://api.github.com/repos/ReagentX/imessage-exporter/releases/latest";
const EXPORTER_STORE_DIR: &str = "exporter";
const VERSIONS_DIR: &str = "versions";
const STAGING_DIR: &str = "staging";
const ACTIVE_VERSION_FILE: &str = "active-version.txt";
const CUSTOM_EXPORTER_FILE: &str = "custom-exporter-path.txt";
const RUN_LOG_DIR: &str = "run-logs";
const DIAGNOSTIC_LOG_DIR: &str = "diagnostic-logs";
const SUPPORT_BUNDLE_DIR: &str = "support-bundles";

#[derive(Serialize)]
struct SystemSnapshot {
    os: String,
    arch: String,
    family: String,
    default_exporter_name: String,
}

#[derive(Serialize)]
struct ExporterProbe {
    found: bool,
    path: Option<String>,
    version: Option<String>,
    raw_version_output: Option<String>,
    error: Option<String>,
    managed: bool,
    source: String,
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    published_at: Option<String>,
    assets: Vec<ReleaseAsset>,
}

#[derive(Clone, Deserialize, Serialize)]
struct ReleaseAsset {
    name: String,
    browser_download_url: String,
    size: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExporterReleaseInfo {
    version: String,
    release_url: String,
    published_at: Option<String>,
    assets: Vec<ReleaseAsset>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedExporterState {
    install_root: String,
    active_path: Option<String>,
    active_version: Option<String>,
    installed_versions: Vec<String>,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedInstallResult {
    release: ExporterReleaseInfo,
    asset_name: String,
    binary_path: String,
    probe: ExporterProbe,
    state: ManagedExporterState,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManagedActivationRequest {
    version: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CustomExporterPathRequest {
    path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedActivationResult {
    probe: ExporterProbe,
    state: ManagedExporterState,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExecuteExporterRequest {
    executable_path: String,
    args: Vec<String>,
    display_command: String,
    output_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportRunResult {
    command: String,
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    success: bool,
    started_at: String,
    completed_at: String,
    log_path: String,
    output_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutputAccessRequest {
    output_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OutputAccessResult {
    path: String,
    resolved_path: String,
    writable: bool,
    checked_at: String,
    detail: String,
    error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticRunRequest {
    executable_path: String,
    args: Vec<String>,
    display_command: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticRunResult {
    command: String,
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    success: bool,
    started_at: String,
    completed_at: String,
    log_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredLogEntry {
    id: String,
    kind: String,
    file_name: String,
    path: String,
    command: Option<String>,
    success: Option<bool>,
    exit_code: Option<i32>,
    started_at: Option<String>,
    completed_at: Option<String>,
    output_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SupportBundleResult {
    bundle_path: String,
    manifest_path: String,
    log_count: usize,
    created_at: String,
}

#[tauri::command]
fn get_system_snapshot() -> SystemSnapshot {
    SystemSnapshot {
        os: env::consts::OS.to_string(),
        arch: env::consts::ARCH.to_string(),
        family: env::consts::FAMILY.to_string(),
        default_exporter_name: exporter_binary_name(),
    }
}

#[tauri::command]
fn get_exporter_management_state(app: AppHandle) -> ManagedExporterState {
    management_state(&app)
}

#[tauri::command]
fn check_latest_exporter_release() -> Result<ExporterReleaseInfo, String> {
    fetch_latest_release().map(release_info)
}

#[tauri::command]
fn install_latest_exporter(app: AppHandle) -> Result<ManagedInstallResult, String> {
    let release = fetch_latest_release()?;
    let asset = select_release_asset(&release)?;

    if asset.name.ends_with(".tar.gz") {
        return Err(format!(
            "Only direct executable assets are supported for managed installs right now. Selected archive: {}",
            asset.name
        ));
    }

    let root = managed_exporter_root(&app)?;
    let version = normalize_version(&release.tag_name);
    let staging_dir = root
        .join(STAGING_DIR)
        .join(format!("{}-{}", version, timestamp_millis()));
    fs::create_dir_all(&staging_dir).map_err(to_string)?;

    let staging_binary_path = staging_dir.join(exporter_binary_name());
    let temp_path = staging_dir.join(format!("{}.download", exporter_binary_name()));
    let bytes = http_client()?
        .get(&asset.browser_download_url)
        .send()
        .map_err(to_string)?
        .error_for_status()
        .map_err(to_string)?
        .bytes()
        .map_err(to_string)?;

    fs::write(&temp_path, bytes).map_err(to_string)?;
    fs::rename(&temp_path, &staging_binary_path).map_err(to_string)?;
    make_executable(&staging_binary_path)?;

    let staging_probe = probe_exporter(staging_binary_path.clone(), true, "managed".to_string());
    if !staging_probe.found {
        let _ = fs::remove_dir_all(&staging_dir);
        return Err(format!(
            "Downloaded imessage-exporter {} could not be verified: {}",
            version,
            probe_error(&staging_probe)
        ));
    }

    let version_dir = root.join(VERSIONS_DIR).join(&version);
    fs::create_dir_all(&version_dir).map_err(to_string)?;

    let binary_path = managed_version_binary_path(&root, &version);
    if binary_path.exists() {
        fs::remove_file(&binary_path).map_err(to_string)?;
    }
    fs::rename(&staging_binary_path, &binary_path).map_err(to_string)?;
    let _ = fs::remove_dir_all(&staging_dir);

    let probe = probe_exporter(binary_path.clone(), true, "managed".to_string());
    if !probe.found {
        return Err(format!(
            "Installed imessage-exporter {} could not be verified: {}",
            version,
            probe_error(&probe)
        ));
    }

    fs::write(root.join(ACTIVE_VERSION_FILE), &version).map_err(to_string)?;
    Ok(ManagedInstallResult {
        release: release_info(release),
        asset_name: asset.name,
        binary_path: binary_path.to_string_lossy().to_string(),
        probe,
        state: management_state(&app),
    })
}

#[tauri::command]
fn activate_managed_exporter_version(
    app: AppHandle,
    request: ManagedActivationRequest,
) -> Result<ManagedActivationResult, String> {
    let version = normalize_version(&request.version);
    if !is_safe_managed_version(&version) {
        return Err("Choose a stored managed exporter version.".to_string());
    }

    let root = managed_exporter_root(&app)?;
    let binary_path = managed_version_binary_path(&root, &version);
    if !binary_path.is_file() {
        return Err(format!(
            "Managed imessage-exporter {} is not installed.",
            version
        ));
    }

    let probe = probe_exporter(binary_path, true, "managed".to_string());
    if !probe.found {
        return Err(format!(
            "Managed imessage-exporter {} could not be verified: {}",
            version,
            probe_error(&probe)
        ));
    }

    fs::write(root.join(ACTIVE_VERSION_FILE), &version).map_err(to_string)?;
    Ok(ManagedActivationResult {
        probe,
        state: management_state(&app),
    })
}

#[tauri::command]
fn detect_exporter(app: AppHandle) -> ExporterProbe {
    detect_exporter_probe(&app)
}

#[tauri::command]
fn set_custom_exporter_path(
    app: AppHandle,
    request: CustomExporterPathRequest,
) -> Result<ExporterProbe, String> {
    let trimmed_path = request.path.trim();
    if trimmed_path.is_empty() {
        return Err("Choose an imessage-exporter binary before saving it.".to_string());
    }

    let path = expand_home_path(trimmed_path);
    if !path.is_file() {
        return Err("The selected imessage-exporter path is not a file.".to_string());
    }

    let probe = probe_exporter(path.clone(), false, "custom".to_string());
    if !probe.found {
        return Err(format!(
            "Selected imessage-exporter could not be verified: {}",
            probe_error(&probe)
        ));
    }

    let root = managed_exporter_root(&app)?;
    fs::create_dir_all(&root).map_err(to_string)?;
    fs::write(root.join(CUSTOM_EXPORTER_FILE), path.to_string_lossy().to_string())
        .map_err(to_string)?;
    Ok(probe)
}

#[tauri::command]
fn clear_custom_exporter_path(app: AppHandle) -> Result<ExporterProbe, String> {
    let root = managed_exporter_root(&app)?;
    match fs::remove_file(root.join(CUSTOM_EXPORTER_FILE)) {
        Ok(()) => Ok(detect_exporter_probe(&app)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Ok(detect_exporter_probe(&app))
        }
        Err(error) => Err(error.to_string()),
    }
}

fn detect_exporter_probe(app: &AppHandle) -> ExporterProbe {
    if let Some(path) = active_managed_exporter_path(app) {
        let probe = probe_exporter(path, true, "managed".to_string());
        if probe.found {
            return probe;
        }
    }

    if let Some(path) = custom_exporter_path(app) {
        return probe_exporter(path, false, "custom".to_string());
    }

    match find_on_path(&exporter_binary_name()) {
        Some(path) => probe_exporter(path, false, "path".to_string()),
        None => ExporterProbe {
            found: false,
            path: None,
            version: None,
            raw_version_output: None,
            error: Some("imessage-exporter was not found on PATH".to_string()),
            managed: false,
            source: "missing".to_string(),
        },
    }
}

#[tauri::command]
fn execute_exporter(
    app: AppHandle,
    request: ExecuteExporterRequest,
) -> Result<ExportRunResult, String> {
    if request.executable_path.trim().is_empty() {
        return Err("Choose or install imessage-exporter before running an export.".to_string());
    }

    let started_at = timestamp_millis();
    let output = Command::new(&request.executable_path)
        .args(&request.args)
        .output();
    let completed_at = timestamp_millis();

    let (stdout, stderr, exit_code, success) = match output {
        Ok(output) => (
            String::from_utf8_lossy(&output.stdout).to_string(),
            String::from_utf8_lossy(&output.stderr).to_string(),
            output.status.code(),
            output.status.success(),
        ),
        Err(error) => (
            String::new(),
            error.to_string(),
            None,
            false,
        ),
    };

    let log_path = write_run_log(
        &app,
        &request,
        &stdout,
        &stderr,
        exit_code,
        success,
        &started_at,
        &completed_at,
    )?;

    Ok(ExportRunResult {
        command: request.display_command,
        stdout,
        stderr,
        exit_code,
        success,
        started_at,
        completed_at,
        log_path: log_path.to_string_lossy().to_string(),
        output_path: request.output_path,
    })
}

#[tauri::command]
fn check_output_access(request: OutputAccessRequest) -> OutputAccessResult {
    let checked_at = timestamp_millis();
    let path = request.output_path.trim().to_string();
    if path.is_empty() {
        return OutputAccessResult {
            path,
            resolved_path: String::new(),
            writable: false,
            checked_at,
            detail: "Choose an output folder before checking write access.".to_string(),
            error: Some("Output folder is empty.".to_string()),
        };
    }

    let resolved_path = resolve_output_path(&path);
    let resolved_path_text = resolved_path.to_string_lossy().to_string();
    match writable_probe_directory(&resolved_path) {
        Ok((directory, target_exists)) => {
            let probe_path = directory.join(format!(
                ".chatexportmate-write-test-{}.tmp",
                checked_at
            ));
            match fs::write(&probe_path, b"write test").and_then(|_| fs::remove_file(&probe_path))
            {
                Ok(()) => OutputAccessResult {
                    path,
                    resolved_path: resolved_path_text,
                    writable: true,
                    checked_at,
                    detail: if target_exists {
                        "Output folder is writable.".to_string()
                    } else {
                        "Parent folder is writable; the export folder can be created.".to_string()
                    },
                    error: None,
                },
                Err(error) => OutputAccessResult {
                    path,
                    resolved_path: resolved_path_text,
                    writable: false,
                    checked_at,
                    detail: "Output folder is not writable.".to_string(),
                    error: Some(error.to_string()),
                },
            }
        }
        Err(error) => OutputAccessResult {
            path,
            resolved_path: resolved_path_text,
            writable: false,
            checked_at,
            detail: error.clone(),
            error: Some(error),
        },
    }
}

#[tauri::command]
fn run_exporter_diagnostics(
    app: AppHandle,
    request: DiagnosticRunRequest,
) -> Result<DiagnosticRunResult, String> {
    if request.executable_path.trim().is_empty() {
        return Err("Choose or install imessage-exporter before running diagnostics.".to_string());
    }

    let started_at = timestamp_millis();
    let output = Command::new(&request.executable_path)
        .args(&request.args)
        .output();
    let completed_at = timestamp_millis();

    let (stdout, stderr, exit_code, success) = match output {
        Ok(output) => (
            String::from_utf8_lossy(&output.stdout).to_string(),
            String::from_utf8_lossy(&output.stderr).to_string(),
            output.status.code(),
            output.status.success(),
        ),
        Err(error) => (
            String::new(),
            error.to_string(),
            None,
            false,
        ),
    };

    let log_path = write_diagnostic_log(
        &app,
        &request,
        &stdout,
        &stderr,
        exit_code,
        success,
        &started_at,
        &completed_at,
    )?;

    Ok(DiagnosticRunResult {
        command: request.display_command,
        stdout,
        stderr,
        exit_code,
        success,
        started_at,
        completed_at,
        log_path: log_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn list_exporter_logs(app: AppHandle) -> Result<Vec<StoredLogEntry>, String> {
    let mut logs = Vec::new();
    collect_stored_logs(&mut logs, run_log_root(&app)?, "export")?;
    collect_stored_logs(&mut logs, diagnostic_log_root(&app)?, "diagnostic")?;
    logs.sort_by(|left, right| log_sort_key(right).cmp(&log_sort_key(left)));
    Ok(logs)
}

#[tauri::command]
fn create_support_bundle(app: AppHandle) -> Result<SupportBundleResult, String> {
    let created_at = timestamp_millis();
    let bundle_path = support_bundle_root(&app)?.join(format!("support-bundle-{created_at}"));
    let logs_path = bundle_path.join("logs");
    fs::create_dir_all(&logs_path).map_err(to_string)?;

    let export_log_count = copy_log_files(run_log_root(&app)?, logs_path.join(RUN_LOG_DIR))?;
    let diagnostic_log_count =
        copy_log_files(diagnostic_log_root(&app)?, logs_path.join(DIAGNOSTIC_LOG_DIR))?;
    let log_count = export_log_count + diagnostic_log_count;
    let manifest_path = bundle_path.join("manifest.txt");

    fs::write(
        &manifest_path,
        support_bundle_manifest(&app, &created_at, export_log_count, diagnostic_log_count),
    )
    .map_err(to_string)?;

    Ok(SupportBundleResult {
        bundle_path: bundle_path.to_string_lossy().to_string(),
        manifest_path: manifest_path.to_string_lossy().to_string(),
        log_count,
        created_at,
    })
}

fn exporter_binary_name() -> String {
    if cfg!(windows) {
        "imessage-exporter.exe".to_string()
    } else {
        "imessage-exporter".to_string()
    }
}

fn find_on_path(binary_name: &str) -> Option<PathBuf> {
    let path_var = env::var_os("PATH")?;
    env::split_paths(&path_var)
        .map(|directory| directory.join(binary_name))
        .find(|candidate| candidate.is_file())
}

fn expand_home_path(path: &str) -> PathBuf {
    if path == "~" {
        return home_dir().unwrap_or_else(|| PathBuf::from(path));
    }

    if let Some(rest) = path.strip_prefix("~/").or_else(|| path.strip_prefix("~\\")) {
        if let Some(home) = home_dir() {
            return home.join(rest);
        }
    }

    PathBuf::from(path)
}

fn resolve_output_path(path: &str) -> PathBuf {
    let expanded_path = expand_home_path(path);
    if expanded_path.is_absolute() {
        return expanded_path;
    }

    env::current_dir()
        .map(|current_dir| current_dir.join(&expanded_path))
        .unwrap_or(expanded_path)
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("USERPROFILE")
        .or_else(|| env::var_os("HOME"))
        .map(PathBuf::from)
}

fn writable_probe_directory(path: &Path) -> Result<(PathBuf, bool), String> {
    if path.exists() {
        if path.is_dir() {
            return Ok((path.to_path_buf(), true));
        }

        return Err("Output path points to a file. Choose a folder instead.".to_string());
    }

    match path.parent().filter(|parent| !parent.as_os_str().is_empty()) {
        Some(parent) if parent.is_dir() => Ok((parent.to_path_buf(), false)),
        _ => Err("Output folder does not exist and its parent folder was not found.".to_string()),
    }
}

fn managed_exporter_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(EXPORTER_STORE_DIR))
        .map_err(to_string)
}

fn run_log_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(RUN_LOG_DIR))
        .map_err(to_string)
}

fn diagnostic_log_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(DIAGNOSTIC_LOG_DIR))
        .map_err(to_string)
}

fn support_bundle_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(SUPPORT_BUNDLE_DIR))
        .map_err(to_string)
}

fn copy_log_files(source_root: PathBuf, destination_root: PathBuf) -> Result<usize, String> {
    if !source_root.exists() {
        return Ok(0);
    }

    fs::create_dir_all(&destination_root).map_err(to_string)?;
    let mut copied_count = 0;
    for entry in fs::read_dir(source_root).map_err(to_string)?.filter_map(Result::ok) {
        let source_path = entry.path();
        if source_path.extension().and_then(|extension| extension.to_str()) != Some("log") {
            continue;
        }

        let Some(file_name) = source_path.file_name() else {
            continue;
        };

        fs::copy(&source_path, destination_root.join(file_name)).map_err(to_string)?;
        copied_count += 1;
    }

    Ok(copied_count)
}

fn support_bundle_manifest(
    app: &AppHandle,
    created_at: &str,
    export_log_count: usize,
    diagnostic_log_count: usize,
) -> String {
    let managed_state = management_state(app);
    format!(
        "ChatExportMate support bundle\n\
created_at: {created_at}\n\
os: {}\n\
arch: {}\n\
export_logs: {export_log_count}\n\
diagnostic_logs: {diagnostic_log_count}\n\
active_managed_version: {}\n\
installed_managed_versions: {}\n\n\
Privacy note: this bundle is created locally and is not uploaded by ChatExportMate. Logs may contain local file paths, exporter command arguments, stdout, stderr, and other troubleshooting details. Review the files before sharing them in a bug report.\n",
        env::consts::OS,
        env::consts::ARCH,
        managed_state
            .active_version
            .unwrap_or_else(|| "none".to_string()),
        if managed_state.installed_versions.is_empty() {
            "none".to_string()
        } else {
            managed_state.installed_versions.join(", ")
        }
    )
}

#[allow(clippy::too_many_arguments)]
fn write_run_log(
    app: &AppHandle,
    request: &ExecuteExporterRequest,
    stdout: &str,
    stderr: &str,
    exit_code: Option<i32>,
    success: bool,
    started_at: &str,
    completed_at: &str,
) -> Result<PathBuf, String> {
    let root = run_log_root(app)?;
    fs::create_dir_all(&root).map_err(to_string)?;
    let log_path = root.join(format!("export-run-{}.log", started_at));
    let content = format!(
        "started_at: {started_at}\ncompleted_at: {completed_at}\nsuccess: {success}\nexit_code: {}\noutput_path: {}\ncommand: {}\n\nstdout:\n{}\n\nstderr:\n{}\n",
        exit_code
            .map(|code| code.to_string())
            .unwrap_or_else(|| "none".to_string()),
        request.output_path,
        request.display_command,
        stdout,
        stderr
    );
    fs::write(&log_path, content).map_err(to_string)?;
    Ok(log_path)
}

#[allow(clippy::too_many_arguments)]
fn write_diagnostic_log(
    app: &AppHandle,
    request: &DiagnosticRunRequest,
    stdout: &str,
    stderr: &str,
    exit_code: Option<i32>,
    success: bool,
    started_at: &str,
    completed_at: &str,
) -> Result<PathBuf, String> {
    let root = diagnostic_log_root(app)?;
    fs::create_dir_all(&root).map_err(to_string)?;
    let log_path = root.join(format!("diagnostic-run-{}.log", started_at));
    let content = format!(
        "started_at: {started_at}\ncompleted_at: {completed_at}\nsuccess: {success}\nexit_code: {}\ncommand: {}\n\nstdout:\n{}\n\nstderr:\n{}\n",
        exit_code
            .map(|code| code.to_string())
            .unwrap_or_else(|| "none".to_string()),
        request.display_command,
        stdout,
        stderr
    );
    fs::write(&log_path, content).map_err(to_string)?;
    Ok(log_path)
}

fn collect_stored_logs(
    logs: &mut Vec<StoredLogEntry>,
    root: PathBuf,
    kind: &str,
) -> Result<(), String> {
    if !root.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(root).map_err(to_string)?.filter_map(Result::ok) {
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("log") {
            continue;
        }

        let Some(file_name) = path
            .file_name()
            .and_then(|name| name.to_str())
            .map(str::to_string)
        else {
            continue;
        };

        let content = fs::read_to_string(&path).unwrap_or_default();
        logs.push(parse_stored_log(kind, file_name, path, &content));
    }

    Ok(())
}

fn parse_stored_log(
    kind: &str,
    file_name: String,
    path: PathBuf,
    content: &str,
) -> StoredLogEntry {
    let header = parse_log_header(content);
    StoredLogEntry {
        id: format!("{kind}:{file_name}"),
        kind: kind.to_string(),
        file_name,
        path: path.to_string_lossy().to_string(),
        command: header.get("command").cloned(),
        success: header.get("success").and_then(|value| parse_bool(value)),
        exit_code: header
            .get("exit_code")
            .and_then(|value| parse_exit_code(value)),
        started_at: header.get("started_at").cloned(),
        completed_at: header.get("completed_at").cloned(),
        output_path: header.get("output_path").cloned(),
    }
}

fn parse_log_header(content: &str) -> HashMap<String, String> {
    let mut header = HashMap::new();
    for line in content.lines() {
        if line.trim().is_empty() {
            break;
        }

        if let Some((key, value)) = line.split_once(": ") {
            header.insert(key.to_string(), value.to_string());
        }
    }
    header
}

fn parse_bool(value: &str) -> Option<bool> {
    match value {
        "true" => Some(true),
        "false" => Some(false),
        _ => None,
    }
}

fn parse_exit_code(value: &str) -> Option<i32> {
    if value == "none" {
        None
    } else {
        value.parse::<i32>().ok()
    }
}

fn log_sort_key(entry: &StoredLogEntry) -> u128 {
    entry
        .started_at
        .as_ref()
        .and_then(|value| value.parse::<u128>().ok())
        .unwrap_or_default()
}

fn management_state(app: &AppHandle) -> ManagedExporterState {
    match managed_exporter_root(app) {
        Ok(root) => {
            let active_version = active_managed_version(&root);
            let active_path = active_version
                .as_ref()
                .map(|version| root.join(VERSIONS_DIR).join(version).join(exporter_binary_name()))
                .filter(|path| path.is_file())
                .map(|path| path.to_string_lossy().to_string());

            ManagedExporterState {
                install_root: root.to_string_lossy().to_string(),
                active_path,
                active_version,
                installed_versions: installed_versions(&root),
                error: None,
            }
        }
        Err(error) => ManagedExporterState {
            install_root: String::new(),
            active_path: None,
            active_version: None,
            installed_versions: Vec::new(),
            error: Some(error),
        },
    }
}

fn active_managed_exporter_path(app: &AppHandle) -> Option<PathBuf> {
    let root = managed_exporter_root(app).ok()?;
    let version = active_managed_version(&root)?;
    let path = managed_version_binary_path(&root, &version);
    path.is_file().then_some(path)
}

fn custom_exporter_path(app: &AppHandle) -> Option<PathBuf> {
    let root = managed_exporter_root(app).ok()?;
    fs::read_to_string(root.join(CUSTOM_EXPORTER_FILE))
        .ok()
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty())
        .map(PathBuf::from)
}

fn managed_version_binary_path(root: &Path, version: &str) -> PathBuf {
    root.join(VERSIONS_DIR)
        .join(version)
        .join(exporter_binary_name())
}

fn active_managed_version(root: &Path) -> Option<String> {
    fs::read_to_string(root.join(ACTIVE_VERSION_FILE))
        .ok()
        .map(|version| version.trim().to_string())
        .filter(|version| !version.is_empty())
}

fn installed_versions(root: &Path) -> Vec<String> {
    let mut versions = fs::read_dir(root.join(VERSIONS_DIR))
        .ok()
        .into_iter()
        .flat_map(|entries| entries.filter_map(Result::ok))
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| entry.file_name().into_string().ok())
        .collect::<Vec<_>>();
    versions.sort();
    versions.reverse();
    versions
}

fn fetch_latest_release() -> Result<GitHubRelease, String> {
    http_client()?
        .get(LATEST_RELEASE_URL)
        .send()
        .map_err(to_string)?
        .error_for_status()
        .map_err(to_string)?
        .json::<GitHubRelease>()
        .map_err(to_string)
}

fn http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(120))
        .user_agent("ChatExportMate/0.1")
        .build()
        .map_err(to_string)
}

fn release_info(release: GitHubRelease) -> ExporterReleaseInfo {
    ExporterReleaseInfo {
        version: normalize_version(&release.tag_name),
        release_url: release.html_url,
        published_at: release.published_at,
        assets: release.assets,
    }
}

fn select_release_asset(release: &GitHubRelease) -> Result<ReleaseAsset, String> {
    let target = target_triple().ok_or_else(|| {
        format!(
            "No prebuilt imessage-exporter asset is known for {} {}",
            env::consts::OS,
            env::consts::ARCH
        )
    })?;

    let mut matching_assets = release
        .assets
        .iter()
        .filter(|asset| asset.name.contains(&target))
        .cloned()
        .collect::<Vec<_>>();

    if matching_assets.is_empty() {
        return Err(format!(
            "Release {} does not include an asset for {}",
            release.tag_name, target
        ));
    }

    matching_assets.sort_by_key(|asset| asset.name.ends_with(".tar.gz"));
    matching_assets
        .into_iter()
        .next()
        .ok_or_else(|| "No compatible release asset was selected".to_string())
}

fn target_triple() -> Option<String> {
    match (env::consts::OS, env::consts::ARCH) {
        ("windows", "x86_64") => Some("x86_64-pc-windows-gnu".to_string()),
        ("macos", "x86_64") => Some("x86_64-apple-darwin".to_string()),
        ("macos", "aarch64") => Some("aarch64-apple-darwin".to_string()),
        _ => None,
    }
}

fn normalize_version(version: &str) -> String {
    version.trim().trim_start_matches('v').to_string()
}

fn is_safe_managed_version(version: &str) -> bool {
    !version.is_empty()
        && version.chars().all(|character| {
            character.is_ascii_alphanumeric()
                || character == '.'
                || character == '-'
                || character == '_'
        })
}

fn probe_error(probe: &ExporterProbe) -> String {
    probe
        .error
        .clone()
        .or_else(|| probe.raw_version_output.clone())
        .unwrap_or_else(|| "version check failed without details".to_string())
}

fn probe_exporter(path: PathBuf, managed: bool, source: String) -> ExporterProbe {
    match Command::new(&path).arg("--version").output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let raw = if stdout.is_empty() { stderr } else { stdout };
            ExporterProbe {
                found: output.status.success(),
                path: Some(path.to_string_lossy().to_string()),
                version: parse_version(&raw),
                raw_version_output: if raw.is_empty() { None } else { Some(raw) },
                error: if output.status.success() {
                    None
                } else {
                    Some(format!("version check exited with {}", output.status))
                },
                managed,
                source,
            }
        }
        Err(error) => ExporterProbe {
            found: false,
            path: Some(path.to_string_lossy().to_string()),
            version: None,
            raw_version_output: None,
            error: Some(error.to_string()),
            managed,
            source,
        },
    }
}

fn parse_version(raw: &str) -> Option<String> {
    raw.split_whitespace()
        .find(|part| part.chars().next().is_some_and(|first| first.is_ascii_digit()))
        .map(|part| part.trim_start_matches('v').to_string())
}

#[cfg(unix)]
fn make_executable(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = fs::metadata(path).map_err(to_string)?.permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions).map_err(to_string)
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn to_string(error: impl ToString) -> String {
    error.to_string()
}

fn timestamp_millis() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_system_snapshot,
            get_exporter_management_state,
            check_latest_exporter_release,
            install_latest_exporter,
            activate_managed_exporter_version,
            detect_exporter,
            set_custom_exporter_path,
            clear_custom_exporter_path,
            check_output_access,
            execute_exporter,
            run_exporter_diagnostics,
            list_exporter_logs,
            create_support_bundle
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
