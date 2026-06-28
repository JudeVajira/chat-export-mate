import type { ExporterProbe, ManagedExporterState } from "./types";

export function getInstallActionLabel(
  probe: ExporterProbe,
  updateAvailable: boolean,
): string {
  if (!probe.found) {
    return "Set up exporter";
  }

  if (probe.source === "custom" || probe.source === "path") {
    return updateAvailable ? "Install managed update" : "Install managed copy";
  }

  return updateAvailable ? "Update exporter" : "Reinstall exporter";
}

export function getReleaseStatusLabel(
  checkingRelease: boolean,
  latestVersion: string | null | undefined,
): string {
  if (checkingRelease) {
    return "checking release";
  }

  return latestVersion ? `latest ${latestVersion}` : "release unchecked";
}

export function getUpdateStatusLabel(
  checkingRelease: boolean,
  releaseChecked: boolean,
  updateAvailable: boolean,
  exporterFound: boolean,
): string {
  if (checkingRelease) {
    return "Checking";
  }

  if (updateAvailable || (releaseChecked && !exporterFound)) {
    return "Available";
  }

  return releaseChecked ? "Current" : "Unchecked";
}

export function describeProbeSource(probe: ExporterProbe): string {
  if (probe.managed || probe.source === "managed") {
    return "Managed";
  }

  if (probe.source === "custom") {
    return "Selected";
  }

  if (probe.source === "path") {
    return "PATH";
  }

  if (probe.source === "browser-preview") {
    return "Development";
  }

  return "Exporter";
}

export function isCustomExporterProbe(probe: ExporterProbe): boolean {
  return probe.source === "custom";
}

export function describeManagedState(state: ManagedExporterState): string {
  if (state.error) {
    return state.error;
  }

  if (state.activeVersion && state.activePath) {
    return `Active ${state.activeVersion} in ChatExportMate app data`;
  }

  if (state.installRoot) {
    return "Ready to install in ChatExportMate app data";
  }

  return "Managed exporter store is not available yet.";
}

export function isManagedStoreReady(state: ManagedExporterState): boolean {
  return Boolean(state.installRoot && !state.error);
}

export function getActivatableManagedVersions(state: ManagedExporterState): string[] {
  return state.installedVersions.filter((version) => version !== state.activeVersion);
}

export function describeCachedAssets(state: ManagedExporterState): string {
  const cachedAssets = state.cachedAssets ?? [];
  if (cachedAssets.length === 0) {
    return "None";
  }

  const totalBytes = cachedAssets.reduce((total, asset) => total + asset.size, 0);
  return `${cachedAssets.length} cached ${cachedAssets.length === 1 ? "asset" : "assets"} (${formatCachedAssetSize(totalBytes)})`;
}

export function formatCachedAssetSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${size} B`;
}
