import type { ExporterProbe, ManagedExporterState } from "./types";

export function getInstallActionLabel(
  probe: ExporterProbe,
  updateAvailable: boolean,
): string {
  if (!probe.found) {
    return "Install exporter";
  }

  return updateAvailable ? "Update exporter" : "Reinstall exporter";
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

