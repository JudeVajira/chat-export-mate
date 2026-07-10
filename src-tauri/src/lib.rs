use chrono::Local;
use crabapple::{
    backup::models::manifest::manifest_plist::ManifestData, error::BackupError, Authentication,
    Backup,
};
use flate2::read::GzDecoder;
use imessage_database::{
    tables::{
        handle::Handle,
        messages::{models::Service, Message},
        table::{get_connection, Cacheable, Table, DEFAULT_PATH_IOS},
    },
    util::{dates::get_offset, dirs::default_db_path, query_context::QueryContext},
};
use rusqlite::{Connection, MAIN_DB};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    env, fs,
    io::{BufRead, BufReader, Cursor, ErrorKind, Read, Write},
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
    csv_layout: Option<String>,
    platform: Option<String>,
    source_path: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    conversation_filter: Option<String>,
    backup_password: Option<String>,
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

#[derive(Clone)]
struct IphoneBackupRoot {
    path: PathBuf,
    source: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct IphoneBackupCandidate {
    id: String,
    path: String,
    resolved_path: Option<String>,
    root_path: String,
    source: String,
    display_name: String,
    last_modified: Option<u64>,
    relocated: bool,
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
    let mut preferences = request.preferences;
    remove_sensitive_preference_fields(&mut preferences);
    let content = serde_json::to_string_pretty(&preferences).map_err(to_string)?;
    fs::write(app_data.join(EXPORT_PREFERENCES_FILE), content).map_err(to_string)?;
    Ok(preferences)
}

fn remove_sensitive_preference_fields(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Object(map) => {
            map.retain(|key, nested_value| {
                let keep = !is_sensitive_preference_key(key);
                if keep {
                    remove_sensitive_preference_fields(nested_value);
                }
                keep
            });
        }
        serde_json::Value::Array(items) => {
            for item in items {
                remove_sensitive_preference_fields(item);
            }
        }
        _ => {}
    }
}

fn is_sensitive_preference_key(key: &str) -> bool {
    key.chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect::<String>()
        .to_ascii_lowercase()
        .contains("password")
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
    let structured_csv_export = should_run_structured_csv_export(&request);
    if request.executable_path.trim().is_empty() && !structured_csv_export {
        return Err("Choose or install imessage-exporter before running an export.".to_string());
    }

    let started_at = timestamp_millis();
    let event_id = request
        .event_id
        .clone()
        .unwrap_or_else(|| format!("export-{started_at}"));
    let backup_password = request
        .backup_password
        .as_deref()
        .filter(|password| !password.is_empty());
    let redaction_values = backup_password
        .map(|password| vec![password.to_string()])
        .unwrap_or_default();
    let mut csv_path = None;
    let command_for_log = if structured_csv_export {
        structured_csv_command_label(&request)
    } else {
        request.display_command.clone()
    };
    let mut output = if structured_csv_export {
        match run_structured_csv_export(&app, &event_id, &request, backup_password) {
            Ok(result) => {
                csv_path = Some(result.path.to_string_lossy().to_string());
                ProcessRunOutput {
                    stdout: format!(
                        "ChatExportMate created structured CSV output: {} ({} row{}, {} file{})\n",
                        result.path.to_string_lossy(),
                        result.row_count,
                        if result.row_count == 1 { "" } else { "s" },
                        result.file_count,
                        if result.file_count == 1 { "" } else { "s" },
                    ),
                    stderr: String::new(),
                    exit_code: Some(0),
                    success: true,
                }
            }
            Err(error) => ProcessRunOutput {
                stdout: String::new(),
                stderr: format!("ChatExportMate could not create structured CSV output: {error}\n"),
                exit_code: None,
                success: false,
            },
        }
    } else {
        run_process_with_output_events(
            &app,
            &event_id,
            "export",
            &request.executable_path,
            &request.args,
            backup_password,
            &redaction_values,
        )
    };
    output.stdout = redact_sensitive_text(&output.stdout, &redaction_values);
    output.stderr = redact_sensitive_text(&output.stderr, &redaction_values);
    let completed_at = timestamp_millis();

    if output.success && request.requested_format.as_deref() == Some("csv") {
        if !structured_csv_export {
            match convert_text_export_to_csv(
                &resolve_output_path(&request.output_path),
                request.csv_layout.as_deref(),
            ) {
                Ok(result) => {
                    output.stdout.push_str(&format!(
                        "\nChatExportMate created CSV output: {} ({} row{}, {} file{})\n",
                        result.path.to_string_lossy(),
                        result.row_count,
                        if result.row_count == 1 { "" } else { "s" },
                        result.file_count,
                        if result.file_count == 1 { "" } else { "s" },
                    ));
                    csv_path = Some(result.path.to_string_lossy().to_string());
                }
                Err(error) => {
                    output.success = false;
                    output.stderr.push_str(&format!(
                        "\nChatExportMate could not create CSV from the text export: {error}\n"
                    ));
                }
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
        &command_for_log,
    )?;

    Ok(ExportRunResult {
        command: command_for_log,
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
fn list_iphone_backups() -> Vec<IphoneBackupCandidate> {
    discover_iphone_backups()
}

fn discover_iphone_backups() -> Vec<IphoneBackupCandidate> {
    let mut candidates = Vec::new();
    let mut seen_paths = HashSet::new();

    for root in iphone_backup_roots() {
        collect_iphone_backup_candidates(&root, &mut candidates, &mut seen_paths);
    }

    candidates.sort_by(|left, right| {
        right
            .last_modified
            .unwrap_or_default()
            .cmp(&left.last_modified.unwrap_or_default())
            .then_with(|| left.display_name.cmp(&right.display_name))
    });
    candidates
}

fn iphone_backup_roots() -> Vec<IphoneBackupRoot> {
    iphone_backup_roots_for(
        env::var_os("USERPROFILE").map(PathBuf::from),
        env::var_os("APPDATA").map(PathBuf::from),
        env::var_os("HOME").map(PathBuf::from),
        env::consts::OS,
    )
}

fn iphone_backup_roots_for(
    user_profile: Option<PathBuf>,
    app_data: Option<PathBuf>,
    home: Option<PathBuf>,
    os: &str,
) -> Vec<IphoneBackupRoot> {
    let mut roots = Vec::new();

    if os == "windows" {
        if let Some(path) = user_profile {
            roots.push(IphoneBackupRoot {
                path: path.join("Apple").join("MobileSync").join("Backup"),
                source: "Apple Devices or Microsoft Store iTunes".to_string(),
            });
        }

        if let Some(path) = app_data {
            roots.push(IphoneBackupRoot {
                path: path
                    .join("Apple Computer")
                    .join("MobileSync")
                    .join("Backup"),
                source: "Older iTunes for Windows".to_string(),
            });
        }

        return roots;
    }

    if os == "macos" {
        if let Some(path) = home {
            roots.push(IphoneBackupRoot {
                path: path
                    .join("Library")
                    .join("Application Support")
                    .join("MobileSync")
                    .join("Backup"),
                source: "Finder or Apple Devices on macOS".to_string(),
            });
        }
    }

    roots
}

fn collect_iphone_backup_candidates(
    root: &IphoneBackupRoot,
    candidates: &mut Vec<IphoneBackupCandidate>,
    seen_paths: &mut HashSet<String>,
) {
    if !root.path.is_dir() {
        return;
    }

    let Ok(entries) = fs::read_dir(&root.path) else {
        return;
    };

    let root_path_text = root.path.to_string_lossy().to_string();
    let resolved_root = fs::canonicalize(&root.path).ok();
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if !looks_like_ios_backup_directory(&path) {
            continue;
        }

        let resolved_path = fs::canonicalize(&path).ok();
        let dedupe_key = resolved_path
            .as_ref()
            .unwrap_or(&path)
            .to_string_lossy()
            .to_lowercase();
        if !seen_paths.insert(dedupe_key) {
            continue;
        }

        let relocated = resolved_path
            .as_ref()
            .is_some_and(|resolved| !same_filesystem_path_text(&path, resolved))
            || resolved_root
                .as_ref()
                .is_some_and(|resolved| !same_filesystem_path_text(&root.path, resolved));
        let last_modified = backup_modified_millis(&path);
        candidates.push(IphoneBackupCandidate {
            id: resolved_path
                .as_ref()
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string(),
            path: path.to_string_lossy().to_string(),
            resolved_path: resolved_path.map(|path| path.to_string_lossy().to_string()),
            root_path: root_path_text.clone(),
            source: root.source.clone(),
            display_name: backup_display_name(&path),
            last_modified,
            relocated,
        });
    }
}

fn looks_like_ios_backup_directory(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }

    path.join("Manifest.db").is_file()
        || (path.join("Info.plist").is_file() && path.join("Manifest.plist").is_file())
}

fn backup_modified_millis(path: &Path) -> Option<u64> {
    let mut latest = modified_millis(&fs::metadata(path).ok()?);
    for marker in [
        "Manifest.db",
        "Info.plist",
        "Manifest.plist",
        "Status.plist",
    ] {
        let marker_modified = fs::metadata(path.join(marker))
            .ok()
            .and_then(|metadata| modified_millis(&metadata));
        latest = latest.max(marker_modified);
    }
    latest
}

fn modified_millis(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| duration.as_millis().try_into().ok())
}

fn backup_display_name(path: &Path) -> String {
    let folder_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("backup");
    if folder_name.len() > 14 {
        let suffix = folder_name
            .chars()
            .rev()
            .take(8)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<String>();
        return format!("Backup ending {suffix}");
    }

    format!("Backup {folder_name}")
}

fn same_filesystem_path_text(left: &Path, right: &Path) -> bool {
    let left_text = left.to_string_lossy().replace('/', "\\");
    let right_text = right.to_string_lossy().replace('/', "\\");

    if cfg!(windows) {
        return left_text.eq_ignore_ascii_case(&right_text);
    }

    left_text == right_text
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
        None,
        &[],
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
    stdin_line: Option<&str>,
    redaction_values: &[String],
) -> ProcessRunOutput {
    run_process_collecting_output(
        executable_path,
        args,
        stdin_line,
        redaction_values,
        |stream, line| emit_process_output(app, event_id, kind, stream, line),
    )
}

fn run_process_collecting_output<F>(
    executable_path: &str,
    args: &[String],
    stdin_line: Option<&str>,
    redaction_values: &[String],
    mut emit_output: F,
) -> ProcessRunOutput
where
    F: FnMut(&str, &str),
{
    let mut command = Command::new(executable_path);
    command
        .args(args)
        .stdin(if stdin_line.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            let stderr = redact_sensitive_text(&error.to_string(), redaction_values);
            emit_output("stderr", &stderr);
            return ProcessRunOutput {
                stdout: String::new(),
                stderr,
                exit_code: None,
                success: false,
            };
        }
    };

    let mut stdout = String::new();
    let mut stderr = String::new();

    if let Some(stdin_line) = stdin_line {
        match child.stdin.take() {
            Some(mut child_stdin) => {
                if let Err(error) = child_stdin
                    .write_all(stdin_line.as_bytes())
                    .and_then(|_| child_stdin.write_all(b"\n"))
                    .and_then(|_| child_stdin.flush())
                {
                    let message =
                        format!("Could not send backup password to imessage-exporter: {error}");
                    stderr.push_str(&message);
                    stderr.push('\n');
                    emit_output("stderr", &message);
                }
            }
            None => {
                let message =
                    "Could not send backup password to imessage-exporter: stdin was unavailable."
                        .to_string();
                stderr.push_str(&message);
                stderr.push('\n');
                emit_output("stderr", &message);
            }
        }
    }

    let (sender, receiver) = mpsc::channel::<ProcessPipeChunk>();
    if let Some(stdout) = child.stdout.take() {
        spawn_pipe_reader(stdout, "stdout", sender.clone());
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_pipe_reader(stderr, "stderr", sender.clone());
    }
    drop(sender);

    for chunk in receiver {
        let text = redact_sensitive_text(&chunk.text, redaction_values);
        let line = redact_sensitive_text(&chunk.line, redaction_values);
        if chunk.stream == "stdout" {
            stdout.push_str(&text);
        } else {
            stderr.push_str(&text);
        }

        if !line.is_empty() {
            emit_output(chunk.stream, &line);
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
            let message = redact_sensitive_text(&error.to_string(), redaction_values);
            if !stderr.is_empty() && !stderr.ends_with('\n') {
                stderr.push('\n');
            }
            stderr.push_str(&message);
            emit_output("stderr", &message);
            ProcessRunOutput {
                stdout,
                stderr,
                exit_code: None,
                success: false,
            }
        }
    }
}

fn redact_sensitive_text(text: &str, sensitive_values: &[String]) -> String {
    sensitive_values
        .iter()
        .filter(|value| !value.is_empty())
        .fold(text.to_string(), |redacted, value| {
            redacted.replace(value, "[REDACTED]")
        })
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

fn resolve_input_path(path: &str) -> PathBuf {
    let expanded_path = expand_home_path(path);
    if expanded_path.is_absolute() {
        return expanded_path;
    }

    env::current_dir()
        .map(|current_dir| current_dir.join(&expanded_path))
        .unwrap_or(expanded_path)
}

struct CsvConversionResult {
    path: PathBuf,
    row_count: usize,
    file_count: usize,
}

enum StructuredCsvSource {
    File(PathBuf),
    InMemory(Connection),
}

struct StructuredCsvOptions {
    start_date: Option<String>,
    end_date: Option<String>,
    conversation_filter: Option<String>,
}

struct TextExportMessage {
    sender: String,
    received_at: String,
    message: String,
    source_index: usize,
}

#[derive(Clone)]
struct SpenlioCsvRow {
    sender: String,
    received_at: String,
    message_id: String,
    message: String,
    source_index: usize,
}

fn should_run_structured_csv_export(request: &ExecuteExporterRequest) -> bool {
    request.requested_format.as_deref() == Some("csv")
        && request.csv_layout.as_deref() != Some("transcriptLines")
}

fn structured_csv_command_label(request: &ExecuteExporterRequest) -> String {
    let layout = match request.csv_layout.as_deref() {
        Some("spenlioBySender") => "Spenlio CSV by sender",
        _ => "Spenlio finance CSV",
    };

    format!("ChatExportMate structured export: {layout}")
}

fn run_structured_csv_export(
    app: &AppHandle,
    event_id: &str,
    request: &ExecuteExporterRequest,
    backup_password: Option<&str>,
) -> Result<CsvConversionResult, String> {
    emit_process_output(
        app,
        event_id,
        "export",
        "stdout",
        "Reading the selected Messages source for structured CSV output.",
    );

    let source = open_structured_csv_source(request, backup_password)?;
    let options = StructuredCsvOptions {
        start_date: request.start_date.clone(),
        end_date: request.end_date.clone(),
        conversation_filter: request.conversation_filter.clone(),
    };
    let rows = collect_spenlio_csv_rows_from_source(&source, &options)?;
    let result = write_spenlio_csv_layout(
        &resolve_output_path(&request.output_path),
        request.csv_layout.as_deref(),
        rows,
    )?;

    emit_process_output(
        app,
        event_id,
        "export",
        "stdout",
        &format!(
            "Created structured CSV output with {} row{}.",
            result.row_count,
            if result.row_count == 1 { "" } else { "s" },
        ),
    );

    Ok(result)
}

fn open_structured_csv_source(
    request: &ExecuteExporterRequest,
    backup_password: Option<&str>,
) -> Result<StructuredCsvSource, String> {
    match request.platform.as_deref().unwrap_or("iOS") {
        "iOS" => open_iphone_backup_csv_source(request, backup_password),
        "macOS" => {
            let db_path = request
                .source_path
                .as_deref()
                .filter(|path| !path.trim().is_empty())
                .map(resolve_input_path)
                .unwrap_or_else(default_db_path);

            Ok(StructuredCsvSource::File(db_path))
        }
        _ => Err(
            "Structured CSV export needs a macOS Messages database or iPhone backup.".to_string(),
        ),
    }
}

fn open_iphone_backup_csv_source(
    request: &ExecuteExporterRequest,
    backup_password: Option<&str>,
) -> Result<StructuredCsvSource, String> {
    let backup_path = request
        .source_path
        .as_deref()
        .filter(|path| !path.trim().is_empty())
        .ok_or_else(|| "Choose the iPhone backup folder before exporting CSV.".to_string())
        .map(resolve_input_path)?;

    let manifest_data = ManifestData::from_plist(backup_path.join("Manifest.plist"))
        .map_err(describe_backup_access_error)?;

    if !manifest_data.is_encrypted {
        return Ok(StructuredCsvSource::File(
            backup_path.join(DEFAULT_PATH_IOS),
        ));
    }

    let password = backup_password.filter(|password| !password.is_empty()).ok_or_else(|| {
        "Encrypted backups need the backup password. The password is used only for this export and is not saved."
            .to_string()
    })?;

    let backup = Backup::open(backup_path, &Authentication::Password(password.to_string()))
        .map_err(describe_backup_access_error)?;
    let db = open_decrypted_iphone_messages_database(&backup)?;

    Ok(StructuredCsvSource::InMemory(db))
}

fn open_decrypted_iphone_messages_database(backup: &Backup) -> Result<Connection, String> {
    let (_, file_id) = DEFAULT_PATH_IOS.split_at(3);
    let file = backup
        .get_file(file_id)
        .map_err(describe_backup_access_error)?;
    let mut decrypted_database = backup
        .decrypt_entry_stream(&file)
        .map_err(describe_backup_access_error)?;
    let database_size = usize::try_from(file.metadata.size)
        .map_err(|_| "The decrypted Messages database is too large to load safely.".to_string())?;
    let mut db = Connection::open_in_memory().map_err(to_string)?;
    db.deserialize_read_exact(MAIN_DB, &mut decrypted_database, database_size, true)
        .map_err(to_string)?;
    let _ = db.pragma_update(None, "query_only", "ON");
    let _ = db.pragma_update(None, "temp_store", "MEMORY");

    Ok(db)
}

fn describe_backup_access_error(error: BackupError) -> String {
    match error {
        BackupError::PasswordOrKeyIncorrect
        | BackupError::PasswordOrKeyRequired
        | BackupError::ManifestDbNotFound
        | BackupError::Crypto(_) => {
            "The backup password did not work, or the backup could not be unlocked. Re-enter the password and try again."
                .to_string()
        }
        other => other.to_string(),
    }
}

fn collect_spenlio_csv_rows_from_database(
    db_path: &Path,
    options: &StructuredCsvOptions,
) -> Result<Vec<SpenlioCsvRow>, String> {
    let db = get_connection(db_path).map_err(to_string)?;
    collect_spenlio_csv_rows_from_connection(&db, options)
}

fn collect_spenlio_csv_rows_from_source(
    source: &StructuredCsvSource,
    options: &StructuredCsvOptions,
) -> Result<Vec<SpenlioCsvRow>, String> {
    match source {
        StructuredCsvSource::File(db_path) => {
            collect_spenlio_csv_rows_from_database(db_path, options)
        }
        StructuredCsvSource::InMemory(db) => collect_spenlio_csv_rows_from_connection(db, options),
    }
}

fn collect_spenlio_csv_rows_from_connection(
    db: &Connection,
    options: &StructuredCsvOptions,
) -> Result<Vec<SpenlioCsvRow>, String> {
    let handles = Handle::cache(db).map_err(to_string)?;
    let query_context = build_message_query_context(options)?;
    let mut statement = Message::stream_rows(db, &query_context).map_err(to_string)?;
    let filter = options
        .conversation_filter
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase());
    let offset = get_offset();
    let mut rows = Vec::new();

    for message_result in Message::rows(&mut statement, []).map_err(to_string)? {
        let mut message = message_result.map_err(to_string)?;
        if message.is_from_me || !is_sms_like_message(&message) {
            continue;
        }

        let sender = message
            .handle_id
            .and_then(|handle_id| handles.get(&handle_id).cloned())
            .unwrap_or_else(|| "Unknown".to_string());
        if !is_business_sms_sender(&sender) {
            continue;
        }

        let message_body = structured_message_text(db, &mut message);
        if message_body.is_empty() {
            continue;
        }

        if let Some(filter) = &filter {
            let sender_match = sender.to_ascii_lowercase().contains(filter);
            let body_match = message_body.to_ascii_lowercase().contains(filter);
            if !sender_match && !body_match {
                continue;
            }
        }

        let received_at = message
            .date(offset)
            .map(|date| date.format("%Y-%m-%dT%H:%M:%S%.3f%:z").to_string())
            .map_err(to_string)?;
        let source_index = rows.len();
        rows.push(SpenlioCsvRow {
            sender,
            received_at,
            message_id: structured_message_id(&message, source_index),
            message: message_body,
            source_index,
        });
    }

    if rows.is_empty() {
        return Err(
            "No named business-sender SMS messages were found. Phone-number conversations, email senders, non-SMS messages, and your own sent messages are skipped for finance CSV output."
                .to_string(),
        );
    }

    Ok(rows)
}

fn build_message_query_context(options: &StructuredCsvOptions) -> Result<QueryContext, String> {
    let mut context = QueryContext::default();
    if let Some(start_date) = options
        .start_date
        .as_deref()
        .filter(|date| !date.is_empty())
    {
        context.set_start(start_date).map_err(to_string)?;
    }
    if let Some(end_date) = options.end_date.as_deref().filter(|date| !date.is_empty()) {
        context.set_end(end_date).map_err(to_string)?;
    }

    Ok(context)
}

fn is_sms_like_message(message: &Message) -> bool {
    matches!(message.service(), Service::SMS | Service::RCS)
}

fn structured_message_text(db: &Connection, message: &mut Message) -> String {
    if message
        .text
        .as_deref()
        .is_none_or(|text| text.trim().is_empty())
    {
        if let Ok(body) = message.parse_body(db) {
            message.apply_body(body);
        }
    }

    message
        .text
        .as_deref()
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn structured_message_id(message: &Message, fallback_index: usize) -> String {
    let guid = message.guid.trim();
    if !guid.is_empty() {
        return guid.to_string();
    }

    if message.rowid > 0 {
        return format!("rowid-{}", message.rowid);
    }

    format!("row-{:06}", fallback_index + 1)
}

fn convert_text_export_to_csv(
    output_path: &Path,
    layout: Option<&str>,
) -> Result<CsvConversionResult, String> {
    match layout.unwrap_or("spenlioCombined") {
        "transcriptLines" => convert_text_export_to_transcript_line_csv(output_path),
        "spenlioBySender" => convert_text_export_to_spenlio_sender_csvs(output_path),
        _ => convert_text_export_to_spenlio_combined_csv(output_path),
    }
}

fn convert_text_export_to_transcript_line_csv(
    output_path: &Path,
) -> Result<CsvConversionResult, String> {
    if !output_path.exists() {
        return Err("The export folder was not created.".to_string());
    }

    let mut text_files = Vec::new();
    collect_text_files(output_path, &mut text_files)?;
    text_files.sort();

    if text_files.is_empty() {
        return Err("No text transcript files were found in the export folder.".to_string());
    }

    let csv_path = output_path.join("chatexportmate-transcript-lines.csv");
    let mut csv = String::from("transcript_file,line_number,text\r\n");
    let mut row_count = 0;

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
            csv.push_str("\r\n");
            row_count += 1;
        }
    }

    fs::write(&csv_path, csv).map_err(to_string)?;
    Ok(CsvConversionResult {
        path: csv_path,
        row_count,
        file_count: 1,
    })
}

fn convert_text_export_to_spenlio_combined_csv(
    output_path: &Path,
) -> Result<CsvConversionResult, String> {
    let mut rows = collect_spenlio_csv_rows(output_path)?;
    rows.sort_by(|left, right| {
        left.received_at
            .cmp(&right.received_at)
            .then(left.source_index.cmp(&right.source_index))
    });
    ensure_spenlio_message_ids(&mut rows);

    let csv_path = output_path.join("spenlio-sms-export.csv");
    write_spenlio_csv(&csv_path, &rows)?;

    Ok(CsvConversionResult {
        path: csv_path,
        row_count: rows.len(),
        file_count: 1,
    })
}

fn convert_text_export_to_spenlio_sender_csvs(
    output_path: &Path,
) -> Result<CsvConversionResult, String> {
    let rows = collect_spenlio_csv_rows(output_path)?;
    let folder_path = output_path.join("spenlio-sms-export-by-sender");
    prepare_clean_output_directory(&folder_path)?;

    let mut grouped: BTreeMap<String, Vec<SpenlioCsvRow>> = BTreeMap::new();
    for row in rows {
        grouped.entry(row.sender.clone()).or_default().push(row);
    }

    let mut used_file_names = HashSet::new();
    let mut row_count = 0;
    let mut file_count = 0;

    for (sender, mut sender_rows) in grouped {
        sender_rows.sort_by(|left, right| {
            left.received_at
                .cmp(&right.received_at)
                .then(left.source_index.cmp(&right.source_index))
        });
        ensure_spenlio_message_ids(&mut sender_rows);
        row_count += sender_rows.len();
        file_count += 1;
        let file_name = unique_sender_csv_file_name(&sender, &mut used_file_names, file_count);
        write_spenlio_csv(&folder_path.join(file_name), &sender_rows)?;
    }

    Ok(CsvConversionResult {
        path: folder_path,
        row_count,
        file_count,
    })
}

fn collect_spenlio_csv_rows(output_path: &Path) -> Result<Vec<SpenlioCsvRow>, String> {
    if !output_path.exists() {
        return Err("The export folder was not created.".to_string());
    }

    let mut text_files = Vec::new();
    collect_text_files(output_path, &mut text_files)?;
    text_files.sort();

    if text_files.is_empty() {
        return Err("No text transcript files were found in the export folder.".to_string());
    }

    let mut messages = Vec::new();
    for text_path in text_files {
        let content = fs::read_to_string(&text_path).map_err(to_string)?;
        parse_text_export_messages(&content, &mut messages);
    }

    let mut rows = Vec::new();
    for message in messages {
        if !is_business_sms_sender(&message.sender) {
            continue;
        }

        rows.push(SpenlioCsvRow {
            sender: message.sender,
            received_at: message.received_at,
            message_id: String::new(),
            message: message.message,
            source_index: message.source_index,
        });
    }

    if rows.is_empty() {
        return Err(
            "No named business-sender messages were found in the text export. Phone-number conversations, email senders, and your own sent messages are skipped for finance CSV output."
                .to_string(),
        );
    }

    Ok(rows)
}

fn write_spenlio_csv_layout(
    output_path: &Path,
    layout: Option<&str>,
    mut rows: Vec<SpenlioCsvRow>,
) -> Result<CsvConversionResult, String> {
    if rows.is_empty() {
        return Err("No messages were available for CSV output.".to_string());
    }

    fs::create_dir_all(output_path).map_err(to_string)?;

    match layout.unwrap_or("spenlioCombined") {
        "spenlioBySender" => {
            let folder_path = output_path.join("spenlio-sms-export-by-sender");
            prepare_clean_output_directory(&folder_path)?;

            let mut grouped: BTreeMap<String, Vec<SpenlioCsvRow>> = BTreeMap::new();
            for row in rows {
                grouped.entry(row.sender.clone()).or_default().push(row);
            }

            let mut used_file_names = HashSet::new();
            let mut row_count = 0;
            let mut file_count = 0;
            for (sender, mut sender_rows) in grouped {
                sender_rows.sort_by(|left, right| {
                    left.received_at
                        .cmp(&right.received_at)
                        .then(left.source_index.cmp(&right.source_index))
                });
                ensure_spenlio_message_ids(&mut sender_rows);
                row_count += sender_rows.len();
                file_count += 1;
                let file_name =
                    unique_sender_csv_file_name(&sender, &mut used_file_names, file_count);
                write_spenlio_csv(&folder_path.join(file_name), &sender_rows)?;
            }

            Ok(CsvConversionResult {
                path: folder_path,
                row_count,
                file_count,
            })
        }
        _ => {
            rows.sort_by(|left, right| {
                left.received_at
                    .cmp(&right.received_at)
                    .then(left.source_index.cmp(&right.source_index))
            });
            ensure_spenlio_message_ids(&mut rows);

            let csv_path = output_path.join("spenlio-sms-export.csv");
            write_spenlio_csv(&csv_path, &rows)?;

            Ok(CsvConversionResult {
                path: csv_path,
                row_count: rows.len(),
                file_count: 1,
            })
        }
    }
}

fn parse_text_export_messages(content: &str, messages: &mut Vec<TextExportMessage>) {
    let mut block = Vec::new();
    for line in content.lines() {
        if line.trim().is_empty() {
            flush_text_export_block(&mut block, messages);
            continue;
        }

        block.push(line.to_string());
    }

    flush_text_export_block(&mut block, messages);
}

fn flush_text_export_block(block: &mut Vec<String>, messages: &mut Vec<TextExportMessage>) {
    if block.len() < 3 {
        block.clear();
        return;
    }

    let raw_timestamp = block[0].trim();
    let Some(received_at) = parse_exporter_display_timestamp(raw_timestamp) else {
        block.clear();
        return;
    };
    let sender = clean_text_export_sender(&block[1]);
    let message = block[2..].join("\n").trim().to_string();

    if !sender.is_empty() && !message.is_empty() {
        messages.push(TextExportMessage {
            sender,
            received_at,
            message,
            source_index: messages.len(),
        });
    }

    block.clear();
}

fn parse_exporter_display_timestamp(value: &str) -> Option<String> {
    let parts: Vec<&str> = value.split_whitespace().collect();
    if parts.len() < 5 {
        return None;
    }

    let month = month_name_to_number(parts[0])?;
    let day = parts[1].trim_end_matches(',').parse::<u32>().ok()?;
    let year = parts[2].parse::<i32>().ok()?;
    let time_parts: Vec<&str> = parts[3].split(':').collect();
    if time_parts.len() < 2 {
        return None;
    }

    let mut hour = time_parts[0].parse::<u32>().ok()?;
    let minute = time_parts[1].parse::<u32>().ok()?;
    let second = time_parts
        .get(2)
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(0);
    let meridiem = parts[4].to_ascii_uppercase();

    if meridiem == "PM" && hour < 12 {
        hour += 12;
    } else if meridiem == "AM" && hour == 12 {
        hour = 0;
    }

    if !(1..=12).contains(&month)
        || !(1..=31).contains(&day)
        || hour > 23
        || minute > 59
        || second > 59
    {
        return None;
    }

    Some(format!(
        "{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.000{}",
        local_utc_offset()
    ))
}

fn month_name_to_number(value: &str) -> Option<u32> {
    let lower = value.to_ascii_lowercase();
    [
        "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    ]
    .iter()
    .position(|month| lower.starts_with(month))
    .map(|index| index as u32 + 1)
}

fn local_utc_offset() -> String {
    let offset_seconds = Local::now().offset().local_minus_utc();
    let sign = if offset_seconds >= 0 { '+' } else { '-' };
    let absolute_seconds = offset_seconds.abs();
    let hours = absolute_seconds / 3600;
    let minutes = (absolute_seconds % 3600) / 60;

    format!("{sign}{hours:02}:{minutes:02}")
}

fn clean_text_export_sender(value: &str) -> String {
    value.trim().trim_matches('"').trim().to_string()
}

fn is_business_sms_sender(sender: &str) -> bool {
    let trimmed = sender.trim();
    if trimmed.is_empty() {
        return false;
    }

    let lower = trimmed.to_ascii_lowercase();
    if lower == "me" || lower == "you" {
        return false;
    }

    if trimmed.starts_with('+') || trimmed.contains('@') {
        return false;
    }

    let has_ascii_letter = trimmed
        .chars()
        .any(|character| character.is_ascii_alphabetic());
    let digit_count = trimmed
        .chars()
        .filter(|character| character.is_ascii_digit())
        .count();

    has_ascii_letter || (digit_count > 0 && digit_count < 7)
}

fn write_spenlio_csv(path: &Path, rows: &[SpenlioCsvRow]) -> Result<(), String> {
    let mut csv = String::from("sender,received_at,message_id,message\r\n");
    for row in rows {
        csv.push_str(&csv_escape(&row.sender));
        csv.push(',');
        csv.push_str(&csv_escape(&row.received_at));
        csv.push(',');
        csv.push_str(&csv_escape(&row.message_id));
        csv.push(',');
        csv.push_str(&csv_escape(&row.message));
        csv.push_str("\r\n");
    }

    fs::write(path, csv).map_err(to_string)
}

fn ensure_spenlio_message_ids(rows: &mut [SpenlioCsvRow]) {
    for (index, row) in rows.iter_mut().enumerate() {
        if row.message_id.trim().is_empty() {
            row.message_id = format!("row-{:06}", index + 1);
        }
    }
}

fn unique_sender_csv_file_name(
    sender: &str,
    used_file_names: &mut HashSet<String>,
    fallback_index: usize,
) -> String {
    let base = safe_sender_file_stem(sender, fallback_index);
    let mut candidate = format!("{base}.csv");
    let mut candidate_key = sender_csv_file_key(&candidate);
    let mut suffix = 2;

    while used_file_names.contains(&candidate_key) {
        candidate = format!("{base}-{suffix}.csv");
        candidate_key = sender_csv_file_key(&candidate);
        suffix += 1;
    }

    used_file_names.insert(candidate_key);
    candidate
}

fn safe_sender_file_stem(sender: &str, fallback_index: usize) -> String {
    let mut stem = String::new();
    let mut last_was_separator = false;

    for character in sender.chars() {
        if character.is_ascii_alphanumeric() {
            stem.push(character);
            last_was_separator = false;
        } else if !last_was_separator {
            stem.push('-');
            last_was_separator = true;
        }

        if stem.len() >= 80 {
            break;
        }
    }

    let stem = if stem.trim_matches('-').is_empty() {
        format!("sender-{fallback_index:03}")
    } else {
        stem.trim_matches('-').to_string()
    };

    if is_windows_reserved_file_stem(&stem) {
        format!("sender-{stem}")
    } else {
        stem
    }
}

fn sender_csv_file_key(file_name: &str) -> String {
    file_name.to_ascii_lowercase()
}

fn is_windows_reserved_file_stem(stem: &str) -> bool {
    let base = stem
        .split_once('.')
        .map(|(base, _)| base)
        .unwrap_or(stem)
        .trim_end_matches([' ', '.'])
        .to_ascii_uppercase();

    matches!(
        base.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
    ) || (base.len() == 4
        && (base.starts_with("COM") || base.starts_with("LPT"))
        && base
            .as_bytes()
            .get(3)
            .is_some_and(|digit| (b'1'..=b'9').contains(digit)))
}

fn prepare_clean_output_directory(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => remove_existing_output_path(path, &metadata)?,
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => return Err(error.to_string()),
    }

    fs::create_dir_all(path).map_err(to_string)
}

fn remove_existing_output_path(path: &Path, metadata: &fs::Metadata) -> Result<(), String> {
    let file_type = metadata.file_type();
    if metadata.is_dir() && !file_type.is_symlink() {
        return fs::remove_dir_all(path).map_err(to_string);
    }

    if file_type.is_symlink() && path.is_dir() {
        return fs::remove_dir(path)
            .or_else(|_| fs::remove_file(path))
            .map_err(to_string);
    }

    fs::remove_file(path).map_err(to_string)
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
        "It looks like this portable app is running from a temporary compressed folder. Extract the portable ZIP first, then run the app from the extracted folder so setup files and helper tools stay in a stable location."
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
Privacy note: this bundle is created locally and is not uploaded by ChatExportMate. Logs may contain local file paths, exporter command arguments, stdout, stderr, and other troubleshooting details. Backup passwords are not written to logs or support bundles. Review the files before sharing them in a bug report.\n",
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
    command: &str,
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
        command,
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
            list_iphone_backups,
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

        let result = convert_text_export_to_csv(&root, Some("transcriptLines")).unwrap();
        let csv = fs::read_to_string(result.path).unwrap();

        assert!(csv.contains("transcript_file,line_number,text"));
        assert!(csv.contains("conversation/thread.txt,1,hello"));
        assert!(csv.contains("conversation/thread.txt,3,\"comma, value\""));
        assert!(csv.contains("conversation/thread.txt,4,\"quote \"\"value\"\"\""));
        assert_eq!(result.row_count, 3);
        assert_eq!(result.file_count, 1);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn convert_text_export_to_csv_writes_spenlio_combined_rows() {
        let root = env::temp_dir().join(format!(
            "chatexportmate-spenlio-csv-test-{}-{}",
            std::process::id(),
            timestamp_millis()
        ));
        fs::create_dir_all(&root).unwrap();
        fs::write(
            root.join("thread.txt"),
            [
                "May 21, 2026  1:02:03 PM",
                "BANKSMS",
                "Debit card purchase, with comma",
                "",
                "May 21, 2026  1:04:03 PM",
                "+94771234567",
                "Personal message should be skipped",
                "",
                "May 21, 2026  1:05:03 PM",
                "Me",
                "Own reply should be skipped",
                "",
                "May 21, 2026  1:03:03 PM",
                "SHOP-ALERT",
                "Second business message",
                "",
            ]
            .join("\n"),
        )
        .unwrap();

        let result = convert_text_export_to_csv(&root, Some("spenlioCombined")).unwrap();
        let csv = fs::read_to_string(result.path).unwrap();

        assert_eq!(result.row_count, 2);
        assert_eq!(result.file_count, 1);
        assert!(csv.starts_with("sender,received_at,message_id,message\r\n"));
        assert!(csv.contains("SHOP-ALERT,2026-05-21T13:03:03.000"));
        assert!(csv.contains("BANKSMS,2026-05-21T13:02:03.000"));
        assert!(csv.contains("row-000001,\"Debit card purchase, with comma\""));
        assert!(!csv.contains("+94771234567"));
        assert!(!csv.contains("Own reply should be skipped"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn convert_text_export_to_csv_writes_one_spenlio_csv_per_sender() {
        let root = env::temp_dir().join(format!(
            "chatexportmate-sender-csv-test-{}-{}",
            std::process::id(),
            timestamp_millis()
        ));
        fs::create_dir_all(&root).unwrap();
        fs::write(
            root.join("thread.txt"),
            [
                "Jun 01, 2026  9:00:00 AM",
                "BANKSMS",
                "First bank message",
                "",
                "Jun 01, 2026  9:01:00 AM",
                "SHOP ALERT",
                "Shop message",
                "",
                "Jun 01, 2026  9:02:00 AM",
                "BANKSMS",
                "Second bank message",
                "",
            ]
            .join("\n"),
        )
        .unwrap();

        let stale_folder = root.join("spenlio-sms-export-by-sender");
        fs::create_dir_all(&stale_folder).unwrap();
        fs::write(stale_folder.join("STALE.csv"), "stale").unwrap();

        let result = convert_text_export_to_csv(&root, Some("spenlioBySender")).unwrap();
        let bank_csv = fs::read_to_string(result.path.join("BANKSMS.csv")).unwrap();
        let shop_csv = fs::read_to_string(result.path.join("SHOP-ALERT.csv")).unwrap();

        assert_eq!(result.row_count, 3);
        assert_eq!(result.file_count, 2);
        assert!(!result.path.join("STALE.csv").exists());
        assert!(bank_csv.contains("row-000001,First bank message"));
        assert!(bank_csv.contains("row-000002,Second bank message"));
        assert!(shop_csv.contains("row-000001,Shop message"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn structured_spenlio_csv_uses_apple_message_ids() {
        let db = spenlio_messages_test_db();
        let rows = collect_spenlio_csv_rows_from_connection(
            &db,
            &StructuredCsvOptions {
                start_date: None,
                end_date: None,
                conversation_filter: None,
            },
        )
        .unwrap();

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].sender, "BANKSMS");
        assert_eq!(rows[0].message_id, "SMS-GUID-10");
        assert_eq!(rows[1].sender, "ALERT99");
        assert_eq!(rows[1].message_id, "rowid-12");
        assert!(rows[0].received_at.starts_with("2026-05-21T"));
    }

    #[test]
    fn structured_spenlio_csv_writes_combined_and_sender_layouts_with_real_ids() {
        let rows = collect_spenlio_csv_rows_from_connection(
            &spenlio_messages_test_db(),
            &StructuredCsvOptions {
                start_date: None,
                end_date: None,
                conversation_filter: None,
            },
        )
        .unwrap();
        let root = env::temp_dir().join(format!(
            "chatexportmate-structured-csv-test-{}-{}",
            std::process::id(),
            timestamp_millis()
        ));

        let combined =
            write_spenlio_csv_layout(&root, Some("spenlioCombined"), rows.clone()).unwrap();
        let csv = fs::read_to_string(combined.path).unwrap();
        assert!(csv.starts_with("sender,received_at,message_id,message\r\n"));
        assert!(csv.contains("BANKSMS,"));
        assert!(csv.contains(",SMS-GUID-10,"));
        assert!(csv.contains("ALERT99,"));
        assert!(csv.contains(",rowid-12,"));
        assert!(!csv.contains("+94771234567"));
        assert!(!csv.contains("normal@example.com"));

        let stale_folder = root.join("spenlio-sms-export-by-sender");
        fs::create_dir_all(&stale_folder).unwrap();
        fs::write(stale_folder.join("STALE.csv"), "stale").unwrap();

        let by_sender = write_spenlio_csv_layout(&root, Some("spenlioBySender"), rows).unwrap();
        let bank_csv = fs::read_to_string(by_sender.path.join("BANKSMS.csv")).unwrap();
        let alert_csv = fs::read_to_string(by_sender.path.join("ALERT99.csv")).unwrap();
        assert!(!by_sender.path.join("STALE.csv").exists());
        assert!(bank_csv.contains(",SMS-GUID-10,"));
        assert!(alert_csv.contains(",rowid-12,"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn sender_csv_file_names_are_windows_safe() {
        let mut used_file_names = HashSet::new();

        assert_eq!(
            unique_sender_csv_file_name("BANK", &mut used_file_names, 1),
            "BANK.csv",
        );
        assert_eq!(
            unique_sender_csv_file_name("bank", &mut used_file_names, 2),
            "bank-2.csv",
        );
        assert_eq!(
            unique_sender_csv_file_name("CON", &mut used_file_names, 3),
            "sender-CON.csv",
        );
        assert_eq!(
            unique_sender_csv_file_name("lpt1", &mut used_file_names, 4),
            "sender-lpt1.csv",
        );
    }

    #[test]
    fn structured_spenlio_csv_reads_in_memory_database_image() {
        let source = spenlio_messages_test_db();
        let database_image = source.serialize(MAIN_DB).unwrap();
        let mut db = Connection::open_in_memory().unwrap();
        db.deserialize_read_exact(MAIN_DB, &database_image[..], database_image.len(), true)
            .unwrap();

        let rows = collect_spenlio_csv_rows_from_connection(
            &db,
            &StructuredCsvOptions {
                start_date: None,
                end_date: None,
                conversation_filter: None,
            },
        )
        .unwrap();

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].message_id, "SMS-GUID-10");
        assert_eq!(rows[1].message_id, "rowid-12");
    }

    #[test]
    #[ignore = "requires a local iPhone backup and writes sensitive CSV output outside the repo"]
    fn local_iphone_backup_structured_csv_smoke_export() -> Result<(), String> {
        let backup_path = env::var("CHAT_EXPORT_MATE_REAL_BACKUP_PATH")
            .map_err(|_| "Set CHAT_EXPORT_MATE_REAL_BACKUP_PATH to a local backup folder.")?;
        let output_path = env::var("CHAT_EXPORT_MATE_REAL_OUTPUT_PATH")
            .map_err(|_| "Set CHAT_EXPORT_MATE_REAL_OUTPUT_PATH to an external output folder.")?;
        let output_path = PathBuf::from(output_path);
        ensure_smoke_output_outside_repo(&output_path)?;
        fs::create_dir_all(&output_path)
            .map_err(|_| "Could not create the external smoke output folder.".to_string())?;

        let request = ExecuteExporterRequest {
            executable_path: String::new(),
            args: Vec::new(),
            display_command: "ChatExportMate structured export: Spenlio finance CSV".to_string(),
            output_path: output_path.to_string_lossy().to_string(),
            event_id: None,
            requested_format: Some("csv".to_string()),
            csv_layout: Some("spenlioCombined".to_string()),
            platform: Some("iOS".to_string()),
            source_path: Some(backup_path),
            start_date: None,
            end_date: None,
            conversation_filter: None,
            backup_password: None,
        };
        let source = open_structured_csv_source(&request, None)
            .map_err(|_| "Could not open the local backup Messages source.".to_string())?;
        let rows = collect_spenlio_csv_rows_from_source(
            &source,
            &StructuredCsvOptions {
                start_date: None,
                end_date: None,
                conversation_filter: None,
            },
        )
        .map_err(|_| {
            "Could not extract named business SMS rows from the local backup.".to_string()
        })?;
        let result = write_spenlio_csv_layout(&output_path, Some("spenlioCombined"), rows)
            .map_err(|_| "Could not write the external smoke CSV output.".to_string())?;

        if result.row_count == 0 || result.file_count != 1 {
            return Err("The smoke export did not produce the expected combined CSV.".to_string());
        }

        let metadata = fs::metadata(&result.path)
            .map_err(|_| "The smoke CSV output file was not created.".to_string())?;
        if metadata.len() == 0 {
            return Err("The smoke CSV output file is empty.".to_string());
        }

        Ok(())
    }

    fn ensure_smoke_output_outside_repo(output_path: &Path) -> Result<(), String> {
        let repo_root = env::current_dir()
            .map_err(|_| "Could not identify the repository root.".to_string())?;
        if output_path.starts_with(&repo_root) {
            return Err("Choose an output folder outside the repository.".to_string());
        }

        Ok(())
    }

    #[test]
    fn backup_unlock_errors_use_safe_password_retry_copy() {
        let message = describe_backup_access_error(BackupError::PasswordOrKeyIncorrect);

        assert_eq!(
            message,
            "The backup password did not work, or the backup could not be unlocked. Re-enter the password and try again."
        );
    }

    fn spenlio_messages_test_db() -> Connection {
        use chrono::{TimeZone, Utc};

        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(
            "
            CREATE TABLE handle (
                ROWID INTEGER PRIMARY KEY,
                id TEXT NOT NULL,
                person_centric_id TEXT
            );
            CREATE TABLE chat_message_join (
                chat_id INTEGER,
                message_id INTEGER
            );
            CREATE TABLE message_attachment_join (
                message_id INTEGER
            );
            CREATE TABLE message (
                rowid INTEGER PRIMARY KEY,
                guid TEXT NOT NULL,
                text TEXT,
                service TEXT,
                handle_id INTEGER,
                destination_caller_id TEXT,
                subject TEXT,
                date INTEGER NOT NULL,
                date_read INTEGER DEFAULT 0,
                date_delivered INTEGER DEFAULT 0,
                is_from_me INTEGER NOT NULL DEFAULT 0,
                is_read INTEGER DEFAULT 0,
                item_type INTEGER DEFAULT 0,
                other_handle INTEGER,
                share_status INTEGER DEFAULT 0,
                share_direction INTEGER,
                group_title TEXT,
                group_action_type INTEGER DEFAULT 0,
                associated_message_guid TEXT,
                associated_message_type INTEGER,
                balloon_bundle_id TEXT,
                expressive_send_style_id TEXT,
                thread_originator_guid TEXT,
                thread_originator_part TEXT,
                date_edited INTEGER DEFAULT 0,
                associated_message_emoji TEXT
            );
            INSERT INTO handle (ROWID, id) VALUES
                (1, 'BANKSMS'),
                (2, '+94771234567'),
                (3, 'ALERT99'),
                (4, 'normal@example.com');
            ",
        )
        .unwrap();

        let base_timestamp = Utc
            .with_ymd_and_hms(2026, 5, 21, 13, 2, 3)
            .unwrap()
            .timestamp()
            - get_offset();
        let rows = [
            (
                10,
                "SMS-GUID-10",
                "Card purchase",
                "SMS",
                1,
                base_timestamp,
                0,
            ),
            (
                11,
                "PHONE-GUID-11",
                "Personal sender",
                "SMS",
                2,
                base_timestamp + 1,
                0,
            ),
            (12, "", "Fallback id", "SMS", 3, base_timestamp + 2, 0),
            (
                13,
                "IM-GUID-13",
                "Not SMS",
                "iMessage",
                1,
                base_timestamp + 3,
                0,
            ),
            (
                14,
                "ME-GUID-14",
                "Own sent SMS",
                "SMS",
                1,
                base_timestamp + 4,
                1,
            ),
            (
                15,
                "MAIL-GUID-15",
                "Email sender",
                "SMS",
                4,
                base_timestamp + 5,
                0,
            ),
        ];

        for (rowid, guid, text, service, handle_id, date, is_from_me) in rows {
            db.execute(
                "
                INSERT INTO message (
                    rowid, guid, text, service, handle_id, date, is_from_me
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                ",
                (rowid, guid, text, service, handle_id, date, is_from_me),
            )
            .unwrap();
        }

        db
    }

    #[test]
    fn iphone_backup_roots_use_standard_apple_locations() {
        let windows_roots = iphone_backup_roots_for(
            Some(PathBuf::from(r"C:\Users\Alice")),
            Some(PathBuf::from(r"C:\Users\Alice\AppData\Roaming")),
            None,
            "windows",
        );

        assert_eq!(windows_roots.len(), 2);
        assert_eq!(
            windows_roots[0].path,
            PathBuf::from(r"C:\Users\Alice")
                .join("Apple")
                .join("MobileSync")
                .join("Backup"),
        );
        assert_eq!(
            windows_roots[1].path,
            PathBuf::from(r"C:\Users\Alice\AppData\Roaming")
                .join("Apple Computer")
                .join("MobileSync")
                .join("Backup"),
        );

        let mac_roots =
            iphone_backup_roots_for(None, None, Some(PathBuf::from("/Users/alice")), "macos");
        assert_eq!(mac_roots.len(), 1);
        assert_eq!(
            mac_roots[0].path,
            PathBuf::from("/Users/alice")
                .join("Library")
                .join("Application Support")
                .join("MobileSync")
                .join("Backup"),
        );
    }

    #[test]
    fn ios_backup_directory_detection_requires_backup_markers() {
        let root = env::temp_dir().join(format!(
            "chatexportmate-backup-marker-test-{}-{}",
            std::process::id(),
            timestamp_millis()
        ));
        let backup = root.join("00008110-0012345678901234");
        let partial = root.join("partial");
        fs::create_dir_all(&backup).unwrap();
        fs::create_dir_all(&partial).unwrap();

        assert!(!looks_like_ios_backup_directory(&backup));

        fs::write(backup.join("Manifest.db"), b"sqlite").unwrap();
        assert!(looks_like_ios_backup_directory(&backup));

        fs::write(partial.join("Info.plist"), b"info").unwrap();
        assert!(!looks_like_ios_backup_directory(&partial));

        fs::write(partial.join("Manifest.plist"), b"manifest").unwrap();
        assert!(looks_like_ios_backup_directory(&partial));

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
    fn redact_sensitive_text_removes_exact_secret_values() {
        let secret = "correct horse battery staple";
        let redacted = redact_sensitive_text(
            "password was correct horse battery staple",
            &[secret.to_string()],
        );

        assert_eq!(redacted, "password was [REDACTED]");
    }

    #[test]
    fn process_runner_writes_stdin_and_redacts_the_backup_password() {
        let secret = "correct horse battery staple";
        let (executable, args) = stdin_echo_command();
        let mut emitted_lines: Vec<(String, String)> = Vec::new();

        let output = run_process_collecting_output(
            &executable,
            &args,
            Some(secret),
            &[secret.to_string()],
            |stream, line| emitted_lines.push((stream.to_string(), line.to_string())),
        );

        assert!(output.success, "stderr: {}", output.stderr);
        assert!(output.stdout.contains("[REDACTED]"));
        assert!(output.stderr.contains("[REDACTED]"));
        assert!(!output.stdout.contains(secret));
        assert!(!output.stderr.contains(secret));
        assert!(emitted_lines
            .iter()
            .any(|(_, line)| line.contains("[REDACTED]")));
        assert!(emitted_lines.iter().all(|(_, line)| !line.contains(secret)));
    }

    #[test]
    fn preference_scrubber_removes_password_named_fields_recursively() {
        let mut preferences = serde_json::json!({
            "schemaVersion": 1,
            "backupPassword": "secret",
            "options": {
                "encryptedBackup": true,
                "backup_password": "secret",
                "nested": [{ "cleartext-password": "secret" }]
            }
        });

        remove_sensitive_preference_fields(&mut preferences);
        let serialized = preferences.to_string();

        assert!(!serialized.contains("secret"));
        assert!(!serialized.contains("backupPassword"));
        assert!(!serialized.contains("backup_password"));
        assert!(!serialized.contains("cleartext-password"));
        assert!(serialized.contains("encryptedBackup"));
    }

    #[cfg(windows)]
    fn stdin_echo_command() -> (String, Vec<String>) {
        (
            "powershell.exe".to_string(),
            vec![
                "-NoProfile".to_string(),
                "-Command".to_string(),
                "$p = [Console]::In.ReadLine(); Write-Output \"stdout:$p\"; [Console]::Error.WriteLine(\"stderr:$p\")".to_string(),
            ],
        )
    }

    #[cfg(not(windows))]
    fn stdin_echo_command() -> (String, Vec<String>) {
        (
            "sh".to_string(),
            vec![
                "-c".to_string(),
                "IFS= read -r p; printf 'stdout:%s\\n' \"$p\"; printf 'stderr:%s\\n' \"$p\" >&2"
                    .to_string(),
            ],
        )
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
