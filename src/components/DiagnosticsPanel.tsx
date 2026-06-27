import { useEffect, useState } from "react";
import { Activity, Download, PackageCheck, RefreshCw, RotateCcw } from "lucide-react";
import { getActivatableManagedVersions } from "../domain/exporter/manager";
import type {
  DiagnosticItem,
  ExporterRelease,
  ManagedExporterState,
  SelectedReleaseAsset,
} from "../domain/exporter/types";
import { StatusPill } from "./StatusPill";

export function DiagnosticsPanel({
  diagnostics,
  release,
  selectedAsset,
  managedState,
  activatingManagedVersion,
  checkingRelease,
  installingExporter,
  runningDiagnostics,
  installActionLabel,
  onCheckRelease,
  onInstallLatest,
  onActivateManagedVersion,
  onRunDiagnostics,
}: {
  diagnostics: DiagnosticItem[];
  release: ExporterRelease | null;
  selectedAsset: SelectedReleaseAsset | null;
  managedState: ManagedExporterState;
  activatingManagedVersion: string | null;
  checkingRelease: boolean;
  installingExporter: boolean;
  runningDiagnostics: boolean;
  installActionLabel: string;
  onCheckRelease: () => void;
  onInstallLatest: () => void;
  onActivateManagedVersion: (version: string) => void;
  onRunDiagnostics: () => void;
}) {
  const activatableVersions = getActivatableManagedVersions(managedState);
  const defaultVersion = activatableVersions[0] ?? managedState.activeVersion ?? "";
  const [selectedVersion, setSelectedVersion] = useState(defaultVersion);

  useEffect(() => {
    setSelectedVersion(defaultVersion);
  }, [defaultVersion]);

  const canActivateVersion = Boolean(selectedVersion && selectedVersion !== managedState.activeVersion);
  const isActivatingSelectedVersion = activatingManagedVersion === selectedVersion;

  return (
    <aside className="side-stack">
      <section className="panel diagnostics-panel" aria-labelledby="diagnostics-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Diagnostics</p>
            <h2 id="diagnostics-title">Health checks</h2>
          </div>
          <Activity aria-hidden="true" className="heading-icon" />
        </div>

        <div className="diagnostic-list">
          {diagnostics.map((item) => (
            <div className="diagnostic-row" key={item.id}>
              <div>
                <div className="diagnostic-label">{item.label}</div>
                <p>{item.detail}</p>
              </div>
              <StatusPill state={item.state} />
            </div>
          ))}
        </div>

        <div className="button-grid">
          <button
            className="button button--secondary"
            disabled={runningDiagnostics}
            onClick={onRunDiagnostics}
            type="button"
          >
            <RefreshCw aria-hidden="true" />
            {runningDiagnostics ? "Running" : "Run diagnostics"}
          </button>
          <button
            className="button button--secondary"
            disabled={checkingRelease}
            onClick={onCheckRelease}
            type="button"
          >
            <Download aria-hidden="true" />
            {checkingRelease ? "Checking" : "Check release"}
          </button>
          <button
            className="button button--primary button--install"
            disabled={installingExporter}
            onClick={onInstallLatest}
            type="button"
          >
            <PackageCheck aria-hidden="true" />
            {installingExporter ? "Installing" : installActionLabel}
          </button>
        </div>
      </section>

      <section className="panel release-panel" aria-labelledby="release-title">
        <div className="section-heading section-heading--compact">
          <h2 id="release-title">Release channel</h2>
        </div>
        <dl>
          <div>
            <dt>Latest</dt>
            <dd>{release?.version ?? "Not checked"}</dd>
          </div>
          <div>
            <dt>Asset</dt>
            <dd>{selectedAsset?.asset.name ?? "No asset selected"}</dd>
          </div>
          <div>
            <dt>Managed</dt>
            <dd>{managedState.activeVersion ?? "Not installed"}</dd>
          </div>
          <div>
            <dt>Stored versions</dt>
            <dd>
              {managedState.installedVersions.length > 0
                ? managedState.installedVersions.join(", ")
                : "None"}
            </dd>
          </div>
        </dl>
        {managedState.installedVersions.length > 0 ? (
          <div className="version-switcher">
            <label className="field-label" htmlFor="managed-version">
              Activate stored version
            </label>
            <div className="version-switcher-controls">
              <select
                id="managed-version"
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
                className="button button--secondary"
                disabled={!canActivateVersion || Boolean(activatingManagedVersion)}
                onClick={() => onActivateManagedVersion(selectedVersion)}
                type="button"
              >
                <RotateCcw aria-hidden="true" />
                {isActivatingSelectedVersion
                  ? "Activating"
                  : selectedVersion === managedState.activeVersion
                    ? "Active"
                    : "Activate"}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </aside>
  );
}
