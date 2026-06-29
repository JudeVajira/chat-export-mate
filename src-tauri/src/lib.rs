use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env, fs,
    io::{BufRead, BufReader, Cursor, Read},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tar::Archive;
use tauri::{AppHandle, Emitter, Manager};

const LATEST_RELEASE_URL: &str =
    "https://api.github.com/repos/ReagentX/imessage-exporter/releases/latest";
const EXPORTER_STORE_DIR: &str = "exporter";
const VERSIONS_DIR: &str = "versions";
const CACHE_DIR: &str = "cache";
const STAGING_DIR: &str = "staging";
const ACTIVE_VERSION_FILE: &str = "active-version.txt";
const CUSTOM_EXPORTER_FILE: &str = "custom-exporter-path.txt";
const EXPORT_PREFERENCES_FILE: &str = "export-preferences.json";
const RUN_LOG_DIR: &str = "run-logs";
const DIAGNOSTIC_LOG_DIR: &str = "diagnostic-logs";
const SUPPORT_BUNDLE_DIR: &str = "support-bundles";
const PROCESS_OUTPUT_EVENT: &str = "chatexportmate://process-output";
const MAX_LOG_PREVIEW_BYTES: u64 = 200_000;

#[derive(Serialize)]
struct SystemSnapshot {
    os: String,
    arch: String,
    family: String,
    default_exporter_name: String,
    executable_path: Option<String>,
    launch_warning: Option<String>,
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

struct CachedAssetPayload {
    bytes: Vec<u8>,
    status: String,
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
struct CachedReleaseAsset {
    id: String,
    version: String,
    file_name: String,
    path: String,
    size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedExporterState {
    install_root: String,
    active_path: Option<String>,
    active_version: Option<String>,
    installed_versions: Vec<String>,
    cached_assets: Vec<CachedReleaseAsset>,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedInstallResult {
    release: ExporterReleaseInfo,
    asset_name: String,
    binary_path: String,
    cache_path: String,
    cache_status: String,
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveExportPreferencesRequest {
    preferences: serde_json::Value,
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
    event_id: Option<String>,
    requested_format: Option<String>,
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
    csv_path: Option<String>,
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
    event_id: Option<String>,
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessOutputEvent {
    event_id: String,
    kind: String,
    stream: String,
    line: String,
    timestamp: String,
}

struct ProcessRunOutput {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    success: bool,
}

struct ProcessPipeChunk {
    stream: &'static str,
    text: String,
    line: String,
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredLogDetailRequest {
    kind: String,
    file_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredLogDetail {
    entry: StoredLogEntry,
    content: String,
    size: u64,
    truncated: bool,
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
fn get_system_snapshot(_app: AppHandle) -> SystemSnapshot {
    let executable_path = env::current_exe().ok();
    let launch_warning = executable_path.as_deref().and_then(portable_launch_warning);

    SystemSnapshot {
        os: env::consts::OS.to_string(),
        arch: env::consts::ARCH.to_string(),
        family: env::consts::FAMILY.to_string(),
        default_exporter_name: exporter_binary_name(),
        executable_path: executable_path.map(|path| path.to_string_lossy().to_string()),
        launch_warning,
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

    let root = managed_exporter_root(&app)?;
    let version = normalize_version(&release.tag_name);
    let cache_path = cached_asset_path(&root, &version, &asset.name)?;
    let staging_dir = root
        .join(STAGING_DIR)
        .join(format!("{}-{}", version, timestamp_millis()));
    fs::create_dir_all(&staging_dir).map_err(to_string)?;

    let staging_binary_path = staging_dir.join(exporter_binary_name());
    let temp_path = staging_dir.join(format!("{}.download", exporter_binary_name()));
    let cached_asset = read_or_download_asset(&asset, &cache_path)?;

    stage_downloaded_asset(
        &asset.name,
        &cached_asset.bytes,
        &temp_path,
        &staging_binary_path,
    )?;

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
        cache_path: cache_path.to_string_lossy().to_string(),
        cache_status: cached_asset.status,
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
    fs::write(
        root.join(CUSTOM_EXPORTER_FILE),
        path.to_string_lossy().to_string(),
    )
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

#[tauri::command]
fn get_export_preferences(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let path = export_preferences_path(&app)?;
    if !path.is_file() {
        return Ok(None);
    }

    fs::read_to_string(path)
        .map_err(to_string)
        .and_then(|content| serde_json::from_str(&content).map_err(to_string))
        .map(Some)
}

#[tauri::command]
fn save_export_preferences(
    app: AppHandle,
    request: SaveExportPreferencesRequest,
) -> Result<serde_json::Value, String> {
    let app_data = app.path().app_data_dir().map_err(to_string)?;
    fs::create_dir_all(&app_data).map_err(to_string)?;
    let content = serde_json::to_string_pretty(&request.preferences).map_err(to_string)?;
    fs::write(app_data.join(EXPORT_PREFERENCES_FILE), content).map_err(to_string)?;
    Ok(request.preferences)
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
    let event_id = request
        .event_id
        .clone()
        .unwrap_or_else(|| format!("export-{started_at}"));
    let mut output = run_process_with_output_events(
        &app,
        &event_id,
        "export",
        &request.executable_path,
        &request.args,
    );
    let completed_at = timestamp_millis();
    let mut csv_path = None;

    if output.success && request.requested_format.as_deref() == Some("csv") {
        match convert_text_export_to_csv(&resolve_output_path(&request.output_path)) {
            Ok(path) => {
                output.stdout.push_str(&format!(
                    "\nChatExportMate created CSV file: {}\n",
                    path.to_string_lossy()
                ));
                csv_path = Some(path.to_string_lossy().to_string());
            }
            Err(error) => {
                output.success = false;
                output.stderr.push_str(&format!(
                    "\nChatExportMate could not create CSV from the text export: {error}\n"
                ));
            }
        }
    }

    let log_path = write_run_log(
        &app,
        &request,
        &output.stdout,
        &output.stderr,
        output.exit_code,
        output.success,
        &started_at,
        &completed_at,
        csv_path.as_deref(),
    )?;

    Ok(ExportRunResult {
        command: request.display_command,
        stdout: output.stdout,
        stderr: output.stderr,
        exit_code: output.exit_code,
        success: output.success,
        started_at,
        completed_at,
        log_path: log_path.to_string_lossy().to_string(),
        output_path: request.output_path,
        csv_path,
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
            let probe_path =
                directory.join(format!(".chatexportmate-write-test-{}.tmp", checked_at));
            match fs::write(&probe_path, b"write test").and_then(|_| fs::remove_file(&probe_path)) {
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
    let event_id = request
        .event_id
        .clone()
        .unwrap_or_else(|| format!("diagnostic-{started_at}"));
    let output = run_process_with_output_events(
        &app,
        &event_id,
        "diagnostic",
        &request.executable_path,
        &request.args,
    );
    let completed_at = timestamp_millis();

    let log_path = write_diagnostic_log(
        &app,
        &request,
        &output.stdout,
        &output.stderr,
        output.exit_code,
        output.success,
        &started_at,
        &completed_at,
    )?;

    Ok(DiagnosticRunResult {
        command: request.display_command,
        stdout: output.stdout,
        stderr: output.stderr,
        exit_code: output.exit_code,
        success: output.success,
        started_at,
        completed_at,
        log_path: log_path.to_string_lossy().to_string(),
    })
}

fn run_process_with_output_events(
    app: &AppHandle,
    event_id: &str,
    kind: &str,
    executable_path: &str,
    args: &[String],
) -> ProcessRunOutput {
    let mut child = match Command::new(executable_path)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            let stderr = error.to_string();
            emit_process_output(app, event_id, kind, "stderr", &stderr);
            return ProcessRunOutput {
                stdout: String::new(),
                stderr,
                exit_code: None,
                success: false,
            };
        }
    };

    let (sender, receiver) = mpsc::channel::<ProcessPipeChunk>();
    if let Some(stdout) = child.stdout.take() {
        spawn_pipe_reader(stdout, "stdout", sender.clone());
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_pipe_reader(stderr, "stderr", sender.clone());
    }
    drop(sender);

    let mut stdout = String::new();
    let mut stderr = String::new();
    for chunk in receiver {
        if chunk.stream == "stdout" {
            stdout.push_str(&chunk.text);
        } else {
            stderr.push_str(&chunk.text);
        }

        if !chunk.line.is_empty() {
            emit_process_output(app, event_id, kind, chunk.stream, &chunk.line);
        }
    }

    match child.wait() {
        Ok(status) => ProcessRunOutput {
            stdout,
            stderr,
            exit_code: status.code(),
            success: status.success(),
        },
        Err(error) => {
            let message = error.to_string();
            if !stderr.is_empty() && !stderr.ends_with('\n') {
                stderr.push('\n');
            }
            stderr.push_str(&message);
            emit_process_output(app, event_id, kind, "stderr", &message);
            ProcessRunOutput {
                stdout,
                stderr,
                exit_code: None,
                success: false,
            }
        }
    }
}

fn spawn_pipe_reader<R>(reader: R, stream: &'static str, sender: mpsc::Sender<ProcessPipeChunk>)
where
    R: Read + Send + 'static,
{
    let _ = thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        loop {
            let mut buffer = Vec::new();
            match reader.read_until(b'\n', &mut buffer) {
                Ok(0) => break,
                Ok(_) => {
                    let text = String::from_utf8_lossy(&buffer).to_string();
                    let line = text
                        .trim_end_matches(|character| character == '\r' || character == '\n')
                        .to_string();
                    let _ = sender.send(ProcessPipeChunk { stream, text, line });
                }
                Err(error) => {
                    let line = format!("Could not read process {stream}: {error}");
                    let _ = sender.send(ProcessPipeChunk {
                        stream: "stderr",
                        text: format!("{line}\n"),
                        line,
                    });
                    break;
                }
            }
        }
    });
}

fn emit_process_output(app: &AppHandle, event_id: &str, kind: &str, stream: &str, line: &str) {
    let _ = app.emit(
        PROCESS_OUTPUT_EVENT,
        ProcessOutputEvent {
            event_id: event_id.to_string(),
            kind: kind.to_string(),
            stream: stream.to_string(),
            line: line.to_string(),
            timestamp: timestamp_millis(),
        },
    );
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
fn get_stored_log_detail(
    app: AppHandle,
    request: StoredLogDetailRequest,
) -> Result<StoredLogDetail, String> {
    let kind = request.kind.trim();
    let file_name = request.file_name.trim();
    if !is_safe_log_file_name(file_name) {
        return Err("Choose a saved ChatExportMate log file.".to_string());
    }

    let root = match kind {
        "export" => run_log_root(&app)?,
        "diagnostic" => diagnostic_log_root(&app)?,
        _ => return Err("Choose an export or diagnostic log.".to_string()),
    };
    let path = root.join(file_name);
    if !path.is_file() {
        return Err("The selected log file no longer exists.".to_string());
    }

    let metadata = fs::metadata(&path).map_err(to_string)?;
    let size = metadata.len();
    let content = read_log_preview(&path, size)?;
    let entry = parse_stored_log(kind, file_name.to_string(), path, &content);

    Ok(StoredLogDetail {
        entry,
        content,
        size,
        truncated: size > MAX_LOG_PREVIEW_BYTES,
    })
}

#[tauri::command]
fn create_support_bundle(app: AppHandle) -> Result<SupportBundleResult, String> {
    let created_at = timestamp_millis();
    let bundle_path = support_bundle_root(&app)?.join(format!("support-bundle-{created_at}"));
    let logs_path = bundle_path.join("logs");
    fs::create_dir_all(&logs_path).map_err(to_string)?;

    let export_log_count = copy_log_files(run_log_root(&app)?, logs_path.join(RUN_LOG_DIR))?;
    let diagnostic_log_count = copy_log_files(
        diagnostic_log_root(&app)?,
        logs_path.join(DIAGNOSTIC_LOG_DIR),
    )?;
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

fn convert_text_export_to_csv(output_path: &Path) -> Result<PathBuf, String> {
    if !output_path.exists() {
        return Err("The export folder was not created.".to_string());
    }

    let mut text_files = Vec::new();
    collect_text_files(output_path, &mut text_files)?;
    text_files.sort();

    if text_files.is_empty() {
        return Err("No text transcript files were found in the export folder.".to_string());
    }

    let csv_path = output_path.join("chatexportmate-export.csv");
    let mut csv = String::from("transcript_file,line_number,text\n");

    for text_path in text_files {
        if text_path == csv_path {
            continue;
        }

        let content = fs::read_to_string(&text_path).map_err(to_string)?;
        let transcript_name = text_path
            .strip_prefix(output_path)
            .unwrap_or(&text_path)
            .to_string_lossy()
            .replace('\\', "/");

        for (index, line) in content.lines().enumerate() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            csv.push_str(&csv_escape(&transcript_name));
            csv.push(',');
            csv.push_str(&(index + 1).to_string());
            csv.push(',');
            csv.push_str(&csv_escape(trimmed));
            csv.push('\n');
        }
    }

    fs::write(&csv_path, csv).map_err(to_string)?;
    Ok(csv_path)
}

fn collect_text_files(root: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(root)
        .map_err(to_string)?
        .filter_map(Result::ok)
    {
        let path = entry.path();
        if path.is_dir() {
            collect_text_files(&path, files)?;
            continue;
        }

        if path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("txt"))
        {
            files.push(path);
        }
    }

    Ok(())
}

fn csv_escape(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        return format!("\"{}\"", value.replace('"', "\"\""));
    }

    value.to_string()
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("USERPROFILE")
        .or_else(|| env::var_os("HOME"))
        .map(PathBuf::from)
}

fn portable_launch_warning(executable_path: &Path) -> Option<String> {
    let temp_dir = env::temp_dir();
    let path_text = executable_path.to_string_lossy().to_lowercase();
    let is_temp_launch = executable_path.starts_with(&temp_dir) || path_text.contains("\\temp\\");

    if !is_temp_launch {
        return None;
    }

    Some(
        "It looks like ChatExportMate is running from a temporary compressed folder. Extract the portable ZIP first, then run ChatExportMate.exe from the extracted folder so setup files and helper tools stay in a stable location."
            .to_string(),
    )
}

fn writable_probe_directory(path: &Path) -> Result<(PathBuf, bool), String> {
    if path.exists() {
        if path.is_dir() {
            return Ok((path.to_path_buf(), true));
        }

        return Err("Output path points to a file. Choose a folder instead.".to_string());
    }

    match path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
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

fn export_preferences_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(EXPORT_PREFERENCES_FILE))
        .map_err(to_string)
}

fn copy_log_files(source_root: PathBuf, destination_root: PathBuf) -> Result<usize, String> {
    if !source_root.exists() {
        return Ok(0);
    }

    fs::create_dir_all(&destination_root).map_err(to_string)?;
    let mut copied_count = 0;
    for entry in fs::read_dir(source_root)
        .map_err(to_string)?
        .filter_map(Result::ok)
    {
        let source_path = entry.path();
        if source_path
            .extension()
            .and_then(|extension| extension.to_str())
            != Some("log")
        {
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
    let active_managed_version = managed_state
        .active_version
        .unwrap_or_else(|| "none".to_string());
    let installed_managed_versions = if managed_state.installed_versions.is_empty() {
        "none".to_string()
    } else {
        managed_state.installed_versions.join(", ")
    };
    let cached_asset_count = managed_state.cached_assets.len();

    format!(
        "ChatExportMate support bundle\n\
created_at: {created_at}\n\
os: {}\n\
arch: {}\n\
export_logs: {export_log_count}\n\
diagnostic_logs: {diagnostic_log_count}\n\
active_managed_version: {}\n\
installed_managed_versions: {}\n\
cached_release_assets: {cached_asset_count}\n\n\
Privacy note: this bundle is created locally and is not uploaded by ChatExportMate. Logs may contain local file paths, exporter command arguments, stdout, stderr, and other troubleshooting details. Review the files before sharing them in a bug report.\n",
        env::consts::OS,
        env::consts::ARCH,
        active_managed_version,
        installed_managed_versions
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
    csv_path: Option<&str>,
) -> Result<PathBuf, String> {
    let root = run_log_root(app)?;
    fs::create_dir_all(&root).map_err(to_string)?;
    let log_path = root.join(format!("export-run-{}.log", started_at));
    let content = format!(
        "started_at: {started_at}\ncompleted_at: {completed_at}\nsuccess: {success}\nexit_code: {}\noutput_path: {}\ncsv_path: {}\ncommand: {}\n\nstdout:\n{}\n\nstderr:\n{}\n",
        exit_code
            .map(|code| code.to_string())
            .unwrap_or_else(|| "none".to_string()),
        request.output_path,
        csv_path.unwrap_or("none"),
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

    for entry in fs::read_dir(root)
        .map_err(to_string)?
        .filter_map(Result::ok)
    {
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

fn parse_stored_log(kind: &str, file_name: String, path: PathBuf, content: &str) -> StoredLogEntry {
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

fn is_safe_log_file_name(file_name: &str) -> bool {
    !file_name.is_empty()
        && file_name.ends_with(".log")
        && file_name.chars().all(|character| {
            character.is_ascii_alphanumeric()
                || character == '.'
                || character == '-'
                || character == '_'
        })
}

fn read_log_preview(path: &Path, size: u64) -> Result<String, String> {
    if size <= MAX_LOG_PREVIEW_BYTES {
        return fs::read_to_string(path).map_err(to_string);
    }

    let mut file = fs::File::open(path).map_err(to_string)?;
    let mut buffer = vec![0; MAX_LOG_PREVIEW_BYTES as usize];
    let bytes_read = file.read(&mut buffer).map_err(to_string)?;
    buffer.truncate(bytes_read);
    Ok(String::from_utf8_lossy(&buffer).to_string())
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
                .map(|version| {
                    root.join(VERSIONS_DIR)
                        .join(version)
                        .join(exporter_binary_name())
                })
                .filter(|path| path.is_file())
                .map(|path| path.to_string_lossy().to_string());

            ManagedExporterState {
                install_root: root.to_string_lossy().to_string(),
                active_path,
                active_version,
                installed_versions: installed_versions(&root),
                cached_assets: cached_release_assets(&root),
                error: None,
            }
        }
        Err(error) => ManagedExporterState {
            install_root: String::new(),
            active_path: None,
            active_version: None,
            installed_versions: Vec::new(),
            cached_assets: Vec::new(),
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

fn cached_release_assets(root: &Path) -> Vec<CachedReleaseAsset> {
    let cache_root = root.join(CACHE_DIR);
    let mut assets = Vec::new();

    let Some(version_entries) = fs::read_dir(&cache_root).ok() else {
        return assets;
    };

    for version_entry in version_entries.filter_map(Result::ok) {
        let version_path = version_entry.path();
        if !version_path.is_dir() {
            continue;
        }

        let Some(version) = version_entry.file_name().into_string().ok() else {
            continue;
        };

        let Some(asset_entries) = fs::read_dir(&version_path).ok() else {
            continue;
        };

        for asset_entry in asset_entries.filter_map(Result::ok) {
            let asset_path = asset_entry.path();
            if !asset_path.is_file() {
                continue;
            }

            let Some(file_name) = asset_entry.file_name().into_string().ok() else {
                continue;
            };
            if file_name.ends_with(".download") {
                continue;
            }

            let size = asset_entry
                .metadata()
                .map(|metadata| metadata.len())
                .unwrap_or_default();
            assets.push(CachedReleaseAsset {
                id: format!("{version}/{file_name}"),
                version: version.clone(),
                file_name,
                path: asset_path.to_string_lossy().to_string(),
                size,
            });
        }
    }

    assets.sort_by(|left, right| {
        right
            .version
            .cmp(&left.version)
            .then_with(|| left.file_name.cmp(&right.file_name))
    });
    assets
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

fn cached_asset_path(root: &Path, version: &str, asset_name: &str) -> Result<PathBuf, String> {
    Ok(root
        .join(CACHE_DIR)
        .join(version)
        .join(cache_safe_asset_file_name(asset_name)?))
}

fn cache_safe_asset_file_name(asset_name: &str) -> Result<String, String> {
    let file_name = asset_name
        .trim()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric()
                || character == '.'
                || character == '-'
                || character == '_'
            {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();

    if file_name.is_empty() || file_name.chars().all(|character| character == '.') {
        return Err("Release asset name is not usable for the local cache.".to_string());
    }

    Ok(file_name)
}

fn read_or_download_asset(
    asset: &ReleaseAsset,
    cache_path: &Path,
) -> Result<CachedAssetPayload, String> {
    if cached_asset_is_usable(asset, cache_path) {
        return fs::read(cache_path)
            .map(|bytes| CachedAssetPayload {
                bytes,
                status: "reused".to_string(),
            })
            .map_err(to_string);
    }

    download_asset_to_cache(asset, cache_path)?;
    fs::read(cache_path)
        .map(|bytes| CachedAssetPayload {
            bytes,
            status: "downloaded".to_string(),
        })
        .map_err(to_string)
}

fn cached_asset_is_usable(asset: &ReleaseAsset, cache_path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(cache_path) else {
        return false;
    };

    if !metadata.is_file() || metadata.len() == 0 {
        return false;
    }

    asset
        .size
        .map(|expected_size| expected_size == metadata.len())
        .unwrap_or(true)
}

fn download_asset_to_cache(asset: &ReleaseAsset, cache_path: &Path) -> Result<(), String> {
    let parent = cache_path
        .parent()
        .ok_or_else(|| "Could not resolve the managed download cache directory.".to_string())?;
    fs::create_dir_all(parent).map_err(to_string)?;

    let bytes = http_client()?
        .get(&asset.browser_download_url)
        .send()
        .map_err(to_string)?
        .error_for_status()
        .map_err(to_string)?
        .bytes()
        .map_err(to_string)?;

    if let Some(expected_size) = asset.size {
        if bytes.len() as u64 != expected_size {
            return Err(format!(
                "Downloaded {} bytes for {}, but GitHub reported {} bytes.",
                bytes.len(),
                asset.name,
                expected_size
            ));
        }
    }

    let temp_path = parent.join(format!(
        "{}.{}.download",
        cache_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("asset"),
        timestamp_millis()
    ));

    fs::write(&temp_path, bytes).map_err(to_string)?;
    if cache_path.exists() {
        fs::remove_file(cache_path).map_err(to_string)?;
    }
    fs::rename(temp_path, cache_path).map_err(to_string)
}

fn stage_downloaded_asset(
    asset_name: &str,
    bytes: &[u8],
    temp_path: &Path,
    staging_binary_path: &Path,
) -> Result<(), String> {
    if is_tar_gz_asset(asset_name) {
        extract_exporter_from_tar_gz(bytes, temp_path)?;
    } else {
        fs::write(temp_path, bytes).map_err(to_string)?;
    }

    fs::rename(temp_path, staging_binary_path).map_err(to_string)?;
    make_executable(staging_binary_path)
}

fn extract_exporter_from_tar_gz(bytes: &[u8], temp_path: &Path) -> Result<(), String> {
    let decoder = GzDecoder::new(Cursor::new(bytes));
    let mut archive = Archive::new(decoder);
    let binary_name = exporter_binary_name();
    let mut extracted = false;

    for entry in archive.entries().map_err(to_string)? {
        let mut entry = entry.map_err(to_string)?;
        if !entry.header().entry_type().is_file() {
            continue;
        }

        let is_expected_binary = {
            let entry_path = entry.path().map_err(to_string)?;
            entry_path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|file_name| file_name == binary_name.as_str())
        };

        if !is_expected_binary {
            continue;
        }

        if extracted {
            return Err(format!(
                "Downloaded archive contains more than one {} binary.",
                binary_name
            ));
        }

        entry.unpack(temp_path).map_err(to_string)?;
        extracted = true;
    }

    if !extracted {
        return Err(format!(
            "Downloaded archive did not contain the expected {} binary.",
            binary_name
        ));
    }

    Ok(())
}

fn is_tar_gz_asset(asset_name: &str) -> bool {
    asset_name.ends_with(".tar.gz")
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
        .find(|part| {
            part.chars()
                .next()
                .is_some_and(|first| first.is_ascii_digit())
        })
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
            get_export_preferences,
            save_export_preferences,
            check_output_access,
            execute_exporter,
            run_exporter_diagnostics,
            list_exporter_logs,
            get_stored_log_detail,
            create_support_bundle
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_safe_asset_file_name_replaces_unsafe_characters() {
        assert_eq!(
            cache_safe_asset_file_name("imessage/exporter x64.exe").unwrap(),
            "imessage_exporter_x64.exe",
        );
        assert_eq!(
            cache_safe_asset_file_name("imessage-exporter.tar.gz").unwrap(),
            "imessage-exporter.tar.gz",
        );
        assert!(cache_safe_asset_file_name("...").is_err());
    }

    #[test]
    fn cached_asset_is_usable_requires_content_and_expected_size() {
        let root = env::temp_dir().join(format!(
            "chatexportmate-cache-test-{}-{}",
            std::process::id(),
            timestamp_millis()
        ));
        fs::create_dir_all(&root).unwrap();
        let asset_path = root.join("asset.bin");
        fs::write(&asset_path, b"cached").unwrap();

        assert!(cached_asset_is_usable(
            &ReleaseAsset {
                name: "asset.bin".to_string(),
                browser_download_url: "https://example.test/asset.bin".to_string(),
                size: Some(6),
            },
            &asset_path,
        ));

        assert!(!cached_asset_is_usable(
            &ReleaseAsset {
                name: "asset.bin".to_string(),
                browser_download_url: "https://example.test/asset.bin".to_string(),
                size: Some(7),
            },
            &asset_path,
        ));

        fs::write(&asset_path, b"").unwrap();
        assert!(!cached_asset_is_usable(
            &ReleaseAsset {
                name: "asset.bin".to_string(),
                browser_download_url: "https://example.test/asset.bin".to_string(),
                size: None,
            },
            &asset_path,
        ));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn read_or_download_asset_reports_reused_cache_status() {
        let root = env::temp_dir().join(format!(
            "chatexportmate-cache-status-test-{}-{}",
            std::process::id(),
            timestamp_millis()
        ));
        fs::create_dir_all(&root).unwrap();
        let asset_path = root.join("asset.bin");
        fs::write(&asset_path, b"cached").unwrap();

        let payload = read_or_download_asset(
            &ReleaseAsset {
                name: "asset.bin".to_string(),
                browser_download_url: "https://example.test/asset.bin".to_string(),
                size: Some(6),
            },
            &asset_path,
        )
        .unwrap();

        assert_eq!(payload.bytes, b"cached");
        assert_eq!(payload.status, "reused");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn convert_text_export_to_csv_writes_line_based_rows() {
        let root = env::temp_dir().join(format!(
            "chatexportmate-csv-test-{}-{}",
            std::process::id(),
            timestamp_millis()
        ));
        let nested = root.join("conversation");
        fs::create_dir_all(&nested).unwrap();
        fs::write(
            nested.join("thread.txt"),
            "hello\n\ncomma, value\nquote \"value\"\n",
        )
        .unwrap();

        let csv_path = convert_text_export_to_csv(&root).unwrap();
        let csv = fs::read_to_string(csv_path).unwrap();

        assert!(csv.contains("transcript_file,line_number,text"));
        assert!(csv.contains("conversation/thread.txt,1,hello"));
        assert!(csv.contains("conversation/thread.txt,3,\"comma, value\""));
        assert!(csv.contains("conversation/thread.txt,4,\"quote \"\"value\"\"\""));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn spawn_pipe_reader_trims_line_breaks_and_retains_original_text() {
        let (sender, receiver) = mpsc::channel();
        spawn_pipe_reader(Cursor::new(b"first\r\nsecond".to_vec()), "stdout", sender);

        let chunks = receiver.into_iter().collect::<Vec<_>>();

        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].stream, "stdout");
        assert_eq!(chunks[0].line, "first");
        assert_eq!(chunks[0].text, "first\r\n");
        assert_eq!(chunks[1].line, "second");
        assert_eq!(chunks[1].text, "second");
    }

    #[test]
    fn portable_launch_warning_detects_temp_executables() {
        let temp_executable = env::temp_dir()
            .join("Temp1_ChatExportMate-alpha-windows-x64-portable.zip")
            .join("ChatExportMate.exe");
        let normal_executable = home_dir()
            .unwrap_or_else(env::temp_dir)
            .join("Downloads")
            .join("ChatExportMate")
            .join("ChatExportMate.exe");

        assert!(portable_launch_warning(&temp_executable).is_some());
        assert!(portable_launch_warning(&normal_executable).is_none());
    }

    #[test]
    fn log_file_names_must_be_local_log_files() {
        assert!(is_safe_log_file_name("export-run-123.log"));
        assert!(is_safe_log_file_name("diagnostic_run.123.log"));
        assert!(!is_safe_log_file_name(""));
        assert!(!is_safe_log_file_name("../export-run-123.log"));
        assert!(!is_safe_log_file_name("C:\\logs\\export-run-123.log"));
        assert!(!is_safe_log_file_name("export-run-123.txt"));
    }

    #[test]
    fn read_log_preview_caps_large_files() {
        let root = env::temp_dir().join(format!(
            "chatexportmate-log-preview-test-{}-{}",
            std::process::id(),
            timestamp_millis()
        ));
        fs::create_dir_all(&root).unwrap();
        let log_path = root.join("export-run-large.log");
        let content = "a".repeat((MAX_LOG_PREVIEW_BYTES as usize) + 32);
        fs::write(&log_path, content).unwrap();

        let preview = read_log_preview(&log_path, fs::metadata(&log_path).unwrap().len()).unwrap();

        assert_eq!(preview.len(), MAX_LOG_PREVIEW_BYTES as usize);

        let _ = fs::remove_dir_all(root);
    }
}
