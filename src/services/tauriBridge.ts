import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { fetchLatestExporterRelease } from "../domain/exporter/release";
import type {
  DiagnosticRunRequest,
  DiagnosticRunResult,
  ExporterProbe,
  ExporterRelease,
  ExportRunRequest,
  ExportRunResult,
  ManagedActivationResult,
  ManagedExporterState,
  ManagedInstallResult,
  OutputAccessCheck,
  StoredLogEntry,
  SystemSnapshot,
} from "../domain/exporter/types";

const browserSnapshot: SystemSnapshot = {
  os: navigator.userAgent.includes("Windows") ? "windows" : "unknown",
  arch: "x64",
  family: "browser-preview",
  default_exporter_name: navigator.userAgent.includes("Windows")
    ? "imessage-exporter.exe"
    : "imessage-exporter",
};

const browserProbe: ExporterProbe = {
  found: false,
  path: null,
  version: null,
  raw_version_output: null,
  error: "Desktop exporter detection is available when running inside Tauri.",
  managed: false,
  source: "browser-preview",
};

const browserManagedState: ManagedExporterState = {
  installRoot: "",
  activePath: null,
  activeVersion: null,
  installedVersions: [],
  error: "Managed installs are available when running inside Tauri.",
};

export async function getSystemSnapshot(): Promise<SystemSnapshot> {
  return invokeWithFallback<SystemSnapshot>("get_system_snapshot", browserSnapshot);
}

export async function detectExporter(): Promise<ExporterProbe> {
  return invokeWithFallback<ExporterProbe>("detect_exporter", browserProbe);
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
    throw new Error(browserManagedState.error ?? "Managed installs require the Tauri desktop runtime.");
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
    throw new Error("Managed exporter rollback requires the Tauri desktop runtime.");
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
    throw new Error("Exports can only run inside the Tauri desktop app.");
  }

  try {
    return await invoke<ExportRunResult>("execute_exporter", { request });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function checkOutputAccess(outputPath: string): Promise<OutputAccessCheck> {
  if (!isTauriRuntime()) {
    return {
      path: outputPath,
      resolvedPath: outputPath,
      writable: false,
      checkedAt: "",
      detail: "Desktop write access checks are available when running inside Tauri.",
      error: null,
    };
  }

  try {
    return await invoke<OutputAccessCheck>("check_output_access", {
      request: { outputPath },
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function runExporterDiagnostics(
  request: DiagnosticRunRequest,
): Promise<DiagnosticRunResult> {
  if (!isTauriRuntime()) {
    throw new Error("Exporter diagnostics can only run inside the Tauri desktop app.");
  }

  try {
    return await invoke<DiagnosticRunResult>("run_exporter_diagnostics", { request });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function listExporterLogs(): Promise<StoredLogEntry[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  try {
    return await invoke<StoredLogEntry[]>("list_exporter_logs");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function openOutputFolder(path: string): Promise<void> {
  await openLocalPath(path);
}

export async function openLocalPath(path: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("Opening local files is available when running inside Tauri.");
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

export async function selectAttachmentFolder(): Promise<string | null> {
  return selectSinglePath({
    directory: true,
    title: "Choose attachments folder",
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
    throw new Error("File and folder pickers are available when running inside Tauri.");
  }

  const selected = await open({
    directory: options.directory,
    filters: options.filters,
    multiple: false,
    title: options.title,
  });

  return Array.isArray(selected) ? selected[0] ?? null : selected;
}
