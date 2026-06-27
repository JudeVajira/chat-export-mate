import { validateExportOptions } from "./commandBuilder";
import { isUpdateAvailable, selectBestAsset } from "./release";
import type {
  DiagnosticItem,
  ExportOptions,
  ExporterProbe,
  ExporterRelease,
  ManagedExporterState,
  OutputAccessCheck,
  RuntimeTarget,
  SystemSnapshot,
} from "./types";
import { describeManagedState, describeProbeSource, isManagedStoreReady } from "./manager";

export function buildDiagnostics(
  snapshot: SystemSnapshot,
  probe: ExporterProbe,
  release: ExporterRelease | null,
  target: RuntimeTarget,
  executablePath: string,
  options: ExportOptions,
  managedState?: ManagedExporterState,
  outputAccess?: OutputAccessCheck,
): DiagnosticItem[] {
  const validationIssues = validateExportOptions(executablePath, options);
  const selectedAsset = release ? selectBestAsset(release, target) : null;
  const updateAvailable = release ? isUpdateAvailable(probe.version, release.version) : false;

  return [
    {
      id: "platform",
      label: "Platform",
      detail: `${snapshot.os} ${snapshot.arch}`,
      state: target.os === "unknown" || target.arch === "unknown" ? "warning" : "passed",
    },
    {
      id: "exporter",
      label: "Exporter",
      detail: probe.found
        ? `${describeProbeSource(probe)} ${probe.version ?? "unknown version"} at ${
            probe.path ?? "detected path"
          }`
        : probe.error ?? "imessage-exporter was not found",
      state: probe.found ? "passed" : "action",
    },
    {
      id: "managed-store",
      label: "Managed exporter",
      detail: managedState
        ? describeManagedState(managedState)
        : "Managed exporter store has not been checked",
      state: managedState
        ? managedState.activeVersion
          ? "passed"
          : isManagedStoreReady(managedState)
            ? "warning"
            : "action"
        : "warning",
    },
    {
      id: "release",
      label: "Latest release",
      detail: release
        ? updateAvailable
          ? `Version ${release.version} is available`
          : `Version ${release.version} checked`
        : "Release feed has not been checked",
      state: release ? (updateAvailable ? "warning" : "passed") : "warning",
    },
    {
      id: "asset",
      label: "Download asset",
      detail: selectedAsset
        ? `${selectedAsset.asset.name} selected for ${selectedAsset.targetTriple}${
            selectedAsset.archive ? "; archive will be extracted after download" : ""
          }`
        : "No compatible prebuilt asset selected for this platform",
      state: selectedAsset ? "passed" : target.os === "linux" ? "warning" : "action",
    },
    {
      id: "configuration",
      label: "Configuration",
      detail:
        validationIssues.length === 0
          ? "Export options are ready"
          : validationIssues.map((issue) => issue.message).join(" "),
      state: validationIssues.length === 0 ? "passed" : "action",
    },
    {
      id: "output-access",
      label: "Output access",
      detail: outputAccess?.detail ?? "Desktop write access check has not run",
      state: outputAccess ? outputAccessState(outputAccess) : "warning",
    },
    {
      id: "privacy",
      label: "Privacy",
      detail: "No message data leaves this device",
      state: "passed",
    },
  ];
}

function outputAccessState(outputAccess: OutputAccessCheck): DiagnosticItem["state"] {
  if (outputAccess.writable) {
    return "passed";
  }

  return outputAccess.error ? "action" : "warning";
}
