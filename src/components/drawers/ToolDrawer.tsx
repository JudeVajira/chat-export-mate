import { useEffect, useState } from "react";
import {
  Activity,
  DownloadCloud,
  FileSearch,
  RefreshCw,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import {
  getActivatableManagedVersions,
  isCustomExporterProbe,
} from "../../domain/exporter/manager";
import type { RunProgress } from "../../domain/exporter/runProgress";
import type {
  DiagnosticItem,
  ExporterProbe,
  ExporterRelease,
  ManagedExporterState,
  ProcessOutputEvent,
} from "../../domain/exporter/types";
import { ProgressSteps } from "../ProgressSteps";
import { StatusPill } from "../StatusPill";

export function ToolDrawer({
  activatingManagedVersion,
  checkingRelease,
  clearingCustomExporter,
  diagnostics,
  installActionLabel,
  installingExporter,
  managedState,
  onActivateManagedVersion,
  onCheckRelease,
  onClearCustomExporter,
  onClose,
  onInstallLatest,
  onRunDiagnostics,
  onSelectCustomExporter,
  outputEvents,
  probe,
  progress,
  release,
  runningDiagnostics,
  selectingCustomExporter,
  updateAvailable,
}: {
  activatingManagedVersion: string | null;
  checkingRelease: boolean;
  clearingCustomExporter: boolean;
  diagnostics: DiagnosticItem[];
  installActionLabel: string;
  installingExporter: boolean;
  managedState: ManagedExporterState;
  onActivateManagedVersion: (version: string) => void;
  onCheckRelease: () => void;
  onClearCustomExporter: () => void;
  onClose: () => void;
  onInstallLatest: () => void;
  onRunDiagnostics: () => void;
  onSelectCustomExporter: () => void;
  outputEvents: ProcessOutputEvent[];
  probe: ExporterProbe;
  progress: RunProgress | null;
  release: ExporterRelease | null;
  runningDiagnostics: boolean;
  selectingCustomExporter: boolean;
  updateAvailable: boolean;
}) {
  const activatableVersions = getActivatableManagedVersions(managedState);
  const defaultVersion = activatableVersions[0] ?? managedState.activeVersion ?? "";
  const [selectedVersion, setSelectedVersion] = useState(defaultVersion);

  useEffect(() => {
    setSelectedVersion(defaultVersion);
  }, [defaultVersion]);

  const busy = installingExporter || runningDiagnostics || Boolean(activatingManagedVersion);
  const showProgress =
    busy && progress && ["diagnostics", "managed-install", "managed-activation"].includes(progress.kind);
  const canActivateVersion = Boolean(selectedVersion && selectedVersion !== managedState.activeVersion);

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}>
      <aside aria-labelledby="tool-drawer-title" aria-modal="true" className="drawer" role="dialog">
        <header className="drawer-header">
          <div>
            <h2 id="tool-drawer-title">Export tool</h2>
            <p>The helper program that reads backups and writes files.</p>
          </div>
          <button aria-label="Close export tool" className="button button--ghost button--icon" onClick={onClose} type="button">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="drawer-body">
          <section className="drawer-section">
            <div className="tool-status">
              <div>
                <strong>
                  {probe.found
                    ? `imessage-exporter ${probe.version ?? ""}`.trim()
                    : "Not installed yet"}
                </strong>
                <span>
                  {probe.found
                    ? probe.managed
                      ? "Installed and managed by this app"
                      : "Using a tool you selected"
                    : "It installs automatically with your first export that needs it."}
                </span>
                {release ? (
                  <span>
                    {updateAvailable
                      ? `Version ${release.version} is available.`
                      : `Latest release: ${release.version}.`}
                  </span>
                ) : null}
              </div>
              <button
                className={`button ${updateAvailable || !probe.found ? "button--primary" : "button--secondary"} button--compact`}
                disabled={installingExporter}
                onClick={onInstallLatest}
                type="button"
              >
                <DownloadCloud aria-hidden="true" className={installingExporter ? "spin" : undefined} />
                {installingExporter ? "Working…" : installActionLabel}
              </button>
            </div>
          </section>

          {showProgress && progress ? (
            <section className="drawer-section">
              <ProgressSteps outputEvents={outputEvents} progress={progress} />
            </section>
          ) : null}

          <section className="drawer-section">
            <h3>Health checks</h3>
            <div className="diagnostic-list">
              {diagnostics.map((item) => (
                <div className="diagnostic-row" key={item.id}>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <StatusPill state={item.state} />
                </div>
              ))}
            </div>
            <button
              className="button button--secondary button--compact"
              disabled={runningDiagnostics}
              onClick={onRunDiagnostics}
              type="button"
            >
              <Activity aria-hidden="true" className={runningDiagnostics ? "spin" : undefined} />
              {runningDiagnostics ? "Running check-up…" : "Run a full check-up"}
            </button>
          </section>

          <section className="drawer-section">
            <h3>Advanced</h3>
            <div className="drawer-action-rows">
              <div className="drawer-action-row">
                <div>
                  <strong>Check for a new version</strong>
                  <span>Reads the latest release information from GitHub.</span>
                </div>
                <button
                  className="button button--ghost button--compact"
                  disabled={checkingRelease}
                  onClick={onCheckRelease}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" className={checkingRelease ? "spin" : undefined} />
                  Check
                </button>
              </div>

              <div className="drawer-action-row">
                <div>
                  <strong>Use a tool you already have</strong>
                  <span>Point the app at your own imessage-exporter file.</span>
                </div>
                <button
                  className="button button--ghost button--compact"
                  disabled={selectingCustomExporter}
                  onClick={onSelectCustomExporter}
                  type="button"
                >
                  <FileSearch aria-hidden="true" />
                  Choose file
                </button>
              </div>

              {isCustomExporterProbe(probe) ? (
                <div className="drawer-action-row">
                  <div>
                    <strong>Forget the selected tool</strong>
                    <span>Go back to the app-managed tool.</span>
                  </div>
                  <button
                    className="button button--ghost button--compact"
                    disabled={clearingCustomExporter}
                    onClick={onClearCustomExporter}
                    type="button"
                  >
                    <XCircle aria-hidden="true" />
                    Forget
                  </button>
                </div>
              ) : null}

              {managedState.installedVersions.length > 1 ? (
                <div className="drawer-action-row">
                  <div>
                    <strong>Switch stored version</strong>
                    <span>Roll back to a previously installed version.</span>
                  </div>
                  <div className="version-switcher-controls">
                    <select
                      aria-label="Stored tool version"
                      onChange={(event) => setSelectedVersion(event.currentTarget.value)}
                      value={selectedVersion}
                    >
                      {managedState.installedVersions.map((version) => (
                        <option key={version} value={version}>
                          {version === managedState.activeVersion ? `${version} (active)` : version}
                        </option>
                      ))}
                    </select>
                    <button
                      className="button button--ghost button--compact"
                      disabled={!canActivateVersion || Boolean(activatingManagedVersion)}
                      onClick={() => onActivateManagedVersion(selectedVersion)}
                      type="button"
                    >
                      <RotateCcw
                        aria-hidden="true"
                        className={activatingManagedVersion === selectedVersion ? "spin" : undefined}
                      />
                      {activatingManagedVersion === selectedVersion ? "Switching…" : "Switch"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
