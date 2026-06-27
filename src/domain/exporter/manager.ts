import type { ExporterProbe, ManagedExporterState } from "./types";

export function getInstallActionLabel(
  probe: ExporterProbe,
  updateAvailable: boolean,
): string {
  if (!probe.found) {
    return "Install exporter";
  }

  if (probe.source === "custom" || probe.source === "path") {
    return updateAvailable ? "Install managed update" : "Install managed copy";
  }

  return updateAvailable ? "Update exporter" : "Reinstall exporter";
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
    return "Preview";
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
    return `Active ${state.activeVersion} at ${state.activePath}`;
  }

  if (state.installRoot) {
    return `Ready to install under ${state.installRoot}`;
  }

  return "Managed exporter store is not available yet.";
}

export function isManagedStoreReady(state: ManagedExporterState): boolean {
  return Boolean(state.installRoot && !state.error);
}

export function getActivatableManagedVersions(state: ManagedExporterState): string[] {
  return state.installedVersions.filter((version) => version !== state.activeVersion);
}
