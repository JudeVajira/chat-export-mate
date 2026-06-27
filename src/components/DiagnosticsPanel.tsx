import { Activity, Download, PackageCheck, RefreshCw } from "lucide-react";
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
  checkingRelease,
  installingExporter,
  runningDiagnostics,
  installActionLabel,
  onCheckRelease,
  onInstallLatest,
  onRunDiagnostics,
}: {
  diagnostics: DiagnosticItem[];
  release: ExporterRelease | null;
  selectedAsset: SelectedReleaseAsset | null;
  managedState: ManagedExporterState;
  checkingRelease: boolean;
  installingExporter: boolean;
  runningDiagnostics: boolean;
  installActionLabel: string;
  onCheckRelease: () => void;
  onInstallLatest: () => void;
  onRunDiagnostics: () => void;
}) {
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
      </section>
    </aside>
  );
}
