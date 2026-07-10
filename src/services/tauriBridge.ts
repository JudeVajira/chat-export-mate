import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  coerceExportPreferences,
  createExportPreferences,
} from "../domain/exporter/preferences";
import {
  normalizeLocalPathForDisplay,
  normalizeLocalPathTextForDisplay,
} from "../domain/exporter/paths";
import { fetchLatestExporterRelease } from "../domain/exporter/release";
import type {
  DiagnosticRunRequest,
  DiagnosticRunResult,
  ExportPreferences,
  ExporterProbe,
  ExporterRelease,
  ExportRunRequest,
  ExportRunResult,
  ManagedActivationResult,
  ManagedExporterState,
  ManagedInstallResult,
  IphoneBackupCandidate,
  OutputAccessCheck,
  ProcessOutputEvent,
  StoredLogDetail,
  StoredLogEntry,
  SupportBundleResult,
  SystemSnapshot,
} from "../domain/exporter/types";

export const PROCESS_OUTPUT_EVENT = "chatexportmate://process-output";

const browserSnapshot: SystemSnapshot = {
  os: navigator.userAgent.includes("Windows") ? "windows" : "unknown",
  arch: "x64",
  family: "browser-preview",
  default_exporter_name: navigator.userAgent.includes("Windows")
    ? "imessage-exporter.exe"
    : "imessage-exporter",
  executable_path: null,
  launch_warning: null,
};

const browserProbe: ExporterProbe = {
  found: false,
  path: null,
  version: null,
  raw_version_output: null,
  error: "The export tool cannot be detected in this browser preview build.",
  managed: false,
  source: "browser-preview",
};

const browserManagedState: ManagedExporterState = {
  installRoot: "",
  activePath: null,
  activeVersion: null,
  installedVersions: [],
  cachedAssets: [],
  error: "Tool installs cannot run in this browser preview build.",
};

export async function getSystemSnapshot(): Promise<SystemSnapshot> {
  return invokeWithFallback<SystemSnapshot>("get_system_snapshot", browserSnapshot);
}

export async function detectExporter(): Promise<ExporterProbe> {
  return invokeWithFallback<ExporterProbe>("detect_exporter", browserProbe);
}

export async function loadExportPreferences(): Promise<ExportPreferences | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    return coerceExportPreferences(await invoke<unknown>("get_export_preferences"));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function saveExportPreferences(preferences: ExportPreferences): Promise<ExportPreferences> {
  const normalizedPreferences = createExportPreferences(
    preferences.options,
    preferences.dryRun,
    preferences.savedAt,
  );

  if (!isTauriRuntime()) {
    return normalizedPreferences;
  }

  try {
    await invoke<unknown>("save_export_preferences", {
      request: { preferences: normalizedPreferences },
    });
    return normalizedPreferences;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function setCustomExporterPath(path: string): Promise<ExporterProbe> {
  if (!isTauriRuntime()) {
    throw new Error("Selecting an existing exporter requires the desktop app.");
  }

  try {
    return await invoke<ExporterProbe>("set_custom_exporter_path", {
      request: { path },
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function clearCustomExporterPath(): Promise<ExporterProbe> {
  if (!isTauriRuntime()) {
    throw new Error("Clearing a selected exporter requires the desktop app.");
  }

  try {
    return await invoke<ExporterProbe>("clear_custom_exporter_path");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function getExporterManagementState(): Promise<ManagedExporterState> {
  return invokeWithFallback<ManagedExporterState>(
    "get_exporter_management_state",
    browserManagedState,
  );
}

export async function checkLatestExporterRelease(): Promise<ExporterRelease> {
  try {
    return await invoke<ExporterRelease>("check_latest_exporter_release");
  } catch {
    return fetchLatestExporterRelease();
  }
}

export async function installLatestExporter(): Promise<ManagedInstallResult> {
  if (!isTauriRuntime()) {
    throw new Error(browserManagedState.error ?? "Managed installs require the desktop app.");
  }

  try {
    return await invoke<ManagedInstallResult>("install_latest_exporter");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function activateManagedExporterVersion(
  version: string,
): Promise<ManagedActivationResult> {
  if (!isTauriRuntime()) {
    throw new Error("Managed exporter rollback requires the desktop app.");
  }

  try {
    return await invoke<ManagedActivationResult>("activate_managed_exporter_version", {
      request: { version },
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function executeExporter(request: ExportRunRequest): Promise<ExportRunResult> {
  if (!isTauriRuntime()) {
    throw new Error("Exports can only run inside the desktop app.");
  }

  try {
    return normalizeExportRunResult(
      await invoke<ExportRunResult>("execute_exporter", {
        request: normalizeExportRunRequest(request),
      }),
    );
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function subscribeToProcessOutput(
  onOutput: (event: ProcessOutputEvent) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }

  return listen<ProcessOutputEvent>(PROCESS_OUTPUT_EVENT, (event) => {
    onOutput({
      ...event.payload,
      line: normalizeLocalPathTextForDisplay(event.payload.line),
    });
  });
}

export async function checkOutputAccess(outputPath: string): Promise<OutputAccessCheck> {
  const normalizedOutputPath = normalizeLocalPathForDisplay(outputPath);

  if (!isTauriRuntime()) {
    return {
      path: normalizedOutputPath,
      resolvedPath: normalizedOutputPath,
      writable: false,
      checkedAt: "",
      detail: "Folder access cannot be checked in this browser preview build.",
      error: null,
    };
  }

  try {
    return normalizeOutputAccessCheck(
      await invoke<OutputAccessCheck>("check_output_access", {
        request: { outputPath: normalizedOutputPath },
      }),
    );
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function runExporterDiagnostics(
  request: DiagnosticRunRequest,
): Promise<DiagnosticRunResult> {
  if (!isTauriRuntime()) {
    throw new Error("Exporter diagnostics can only run inside the desktop app.");
  }

  try {
    return normalizeDiagnosticRunResult(
      await invoke<DiagnosticRunResult>("run_exporter_diagnostics", {
        request: normalizeDiagnosticRunRequest(request),
      }),
    );
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function listExporterLogs(): Promise<StoredLogEntry[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  try {
    return (await invoke<StoredLogEntry[]>("list_exporter_logs")).map(normalizeStoredLogEntry);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function getStoredLogDetail(log: StoredLogEntry): Promise<StoredLogDetail> {
  if (!isTauriRuntime()) {
    throw new Error("Saved log previews are available in the desktop app.");
  }

  try {
    return normalizeStoredLogDetail(
      await invoke<StoredLogDetail>("get_stored_log_detail", {
        request: {
          kind: log.kind,
          fileName: log.fileName,
        },
      }),
    );
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function createSupportBundle(): Promise<SupportBundleResult> {
  if (!isTauriRuntime()) {
    throw new Error("Support bundles are available in the desktop app.");
  }

  try {
    return await invoke<SupportBundleResult>("create_support_bundle");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function listIphoneBackups(): Promise<IphoneBackupCandidate[]> {
  return (await invokeWithFallback<IphoneBackupCandidate[]>("list_iphone_backups", [])).map(
    normalizeIphoneBackupCandidate,
  );
}

export async function openOutputFolder(path: string): Promise<void> {
  await openLocalPath(path);
}

export async function openLocalPath(path: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("Opening local files is available in the desktop app.");
  }

  await openPath(path);
}

export async function selectOutputFolder(): Promise<string | null> {
  return selectSinglePath({
    directory: true,
    title: "Choose export folder",
  });
}

export async function selectDatabaseFile(): Promise<string | null> {
  return selectSinglePath({
    directory: false,
    filters: [{ name: "Messages database", extensions: ["db"] }],
    title: "Choose Messages database",
  });
}

export async function selectBackupFolder(): Promise<string | null> {
  return selectSinglePath({
    directory: true,
    title: "Choose iPhone backup folder",
  });
}

export async function selectAttachmentFolder(): Promise<string | null> {
  return selectSinglePath({
    directory: true,
    title: "Choose attachments folder",
  });
}

export async function selectExporterBinary(): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error("Selecting an existing exporter requires the desktop app.");
  }

  return selectSinglePath({
    directory: false,
    title: "Choose exporter tool",
  });
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

async function invokeWithFallback<T>(command: string, fallback: T): Promise<T> {
  try {
    return await invoke<T>(command);
  } catch {
    return fallback;
  }
}

async function selectSinglePath(options: {
  directory: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
  title: string;
}): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error("File and folder pickers are available in the desktop app.");
  }

  const selected = await open({
    directory: options.directory,
    filters: options.filters,
    multiple: false,
    title: options.title,
  });

  const selectedPath = Array.isArray(selected) ? selected[0] ?? null : selected;
  return selectedPath ? normalizeLocalPathForDisplay(selectedPath) : selectedPath;
}

function normalizeOutputAccessCheck(check: OutputAccessCheck): OutputAccessCheck {
  return {
    ...check,
    path: normalizeLocalPathForDisplay(check.path),
    resolvedPath: normalizeLocalPathForDisplay(check.resolvedPath),
  };
}

function normalizeExportRunRequest(request: ExportRunRequest): ExportRunRequest {
  return {
    ...request,
    outputPath: normalizeLocalPathForDisplay(request.outputPath),
    sourcePath: request.sourcePath
      ? normalizeLocalPathForDisplay(request.sourcePath)
      : request.sourcePath,
    args: request.args.map(normalizeLocalPathTextForDisplay),
    displayCommand: normalizeLocalPathTextForDisplay(request.displayCommand),
  };
}

function normalizeDiagnosticRunRequest(request: DiagnosticRunRequest): DiagnosticRunRequest {
  return {
    ...request,
    args: request.args.map(normalizeLocalPathTextForDisplay),
    displayCommand: normalizeLocalPathTextForDisplay(request.displayCommand),
  };
}

function normalizeExportRunResult(result: ExportRunResult): ExportRunResult {
  return {
    ...result,
    command: normalizeLocalPathTextForDisplay(result.command),
    stdout: normalizeLocalPathTextForDisplay(result.stdout),
    stderr: normalizeLocalPathTextForDisplay(result.stderr),
    logPath: normalizeLocalPathForDisplay(result.logPath),
    outputPath: normalizeLocalPathForDisplay(result.outputPath),
    csvPath: result.csvPath ? normalizeLocalPathForDisplay(result.csvPath) : result.csvPath,
  };
}

function normalizeDiagnosticRunResult(result: DiagnosticRunResult): DiagnosticRunResult {
  return {
    ...result,
    command: normalizeLocalPathTextForDisplay(result.command),
    stdout: normalizeLocalPathTextForDisplay(result.stdout),
    stderr: normalizeLocalPathTextForDisplay(result.stderr),
    logPath: normalizeLocalPathForDisplay(result.logPath),
  };
}

function normalizeStoredLogEntry(log: StoredLogEntry): StoredLogEntry {
  return {
    ...log,
    path: normalizeLocalPathForDisplay(log.path),
    command: log.command ? normalizeLocalPathTextForDisplay(log.command) : log.command,
    outputPath: log.outputPath ? normalizeLocalPathForDisplay(log.outputPath) : log.outputPath,
  };
}

function normalizeStoredLogDetail(detail: StoredLogDetail): StoredLogDetail {
  return {
    ...detail,
    entry: normalizeStoredLogEntry(detail.entry),
    content: normalizeLocalPathTextForDisplay(detail.content),
  };
}

function normalizeIphoneBackupCandidate(candidate: IphoneBackupCandidate): IphoneBackupCandidate {
  return {
    ...candidate,
    path: normalizeLocalPathForDisplay(candidate.path),
    resolvedPath: candidate.resolvedPath
      ? normalizeLocalPathForDisplay(candidate.resolvedPath)
      : candidate.resolvedPath,
    rootPath: normalizeLocalPathForDisplay(candidate.rootPath),
  };
}
