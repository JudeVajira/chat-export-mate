import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BadgeCheck,
  DownloadCloud,
  History,
  Lock,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import "./App.css";
import { CommandPreview } from "./components/CommandPreview";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { ExportConfigurator } from "./components/ExportConfigurator";
import { type LogEntry, LogTimeline } from "./components/LogTimeline";
import { SetupChecklist } from "./components/SetupChecklist";
import { StatusPill } from "./components/StatusPill";
import { defaultExecutablePath, defaultExportOptions, initialLogEntries } from "./data/mockWorkspace";
import { buildExporterCommand, validateExportOptions } from "./domain/exporter/commandBuilder";
import { buildDiagnostics } from "./domain/exporter/diagnostics";
import { translateExporterError } from "./domain/exporter/errors";
import { getInstallActionLabel } from "./domain/exporter/manager";
import {
  detectRuntimeTarget,
  isUpdateAvailable,
  selectBestAsset,
} from "./domain/exporter/release";
import type {
  ExporterProbe,
  ExporterRelease,
  ManagedExporterState,
  SystemSnapshot,
} from "./domain/exporter/types";
import {
  checkLatestExporterRelease,
  detectExporter,
  getExporterManagementState,
  getSystemSnapshot,
  installLatestExporter,
} from "./services/tauriBridge";

function App() {
  const [options, setOptions] = useState(defaultExportOptions);
  const [dryRun, setDryRun] = useState(true);
  const [checkingRelease, setCheckingRelease] = useState(false);
  const [installingExporter, setInstallingExporter] = useState(false);
  const [release, setRelease] = useState<ExporterRelease | null>(null);
  const [managedState, setManagedState] = useState<ManagedExporterState>({
    installRoot: "",
    activePath: null,
    activeVersion: null,
    installedVersions: [],
    error: "Managed exporter store has not been checked yet.",
  });
  const [snapshot, setSnapshot] = useState<SystemSnapshot>({
    os: "windows",
    arch: "x64",
    family: "preview",
    default_exporter_name: "imessage-exporter.exe",
  });
  const [probe, setProbe] = useState<ExporterProbe>({
    found: false,
    path: null,
    version: null,
    raw_version_output: null,
    error: "Exporter detection has not run yet.",
    managed: false,
    source: "initial",
  });
  const [logs, setLogs] = useState<LogEntry[]>([...initialLogEntries]);

  const executablePath = probe.path ?? defaultExecutablePath;
  const command = useMemo(() => buildExporterCommand(executablePath, options), [executablePath, options]);
  const issues = useMemo(() => validateExportOptions(executablePath, options), [executablePath, options]);
  const target = useMemo(() => detectRuntimeTarget(snapshot), [snapshot]);
  const selectedAsset = useMemo(() => (release ? selectBestAsset(release, target) : null), [release, target]);
  const diagnostics = useMemo(
    () => buildDiagnostics(snapshot, probe, release, target, executablePath, options, managedState),
    [executablePath, managedState, options, probe, release, snapshot, target],
  );
  const updateAvailable = release ? isUpdateAvailable(probe.version, release.version) : false;
  const installActionLabel = getInstallActionLabel(probe, updateAvailable);

  useEffect(() => {
    void runDiagnostics();
  }, []);

  async function runDiagnostics() {
    const [nextSnapshot, nextProbe, nextManagedState] = await Promise.all([
      getSystemSnapshot(),
      detectExporter(),
      getExporterManagementState(),
    ]);
    setSnapshot(nextSnapshot);
    setProbe(nextProbe);
    setManagedState(nextManagedState);
    addLog(nextProbe.found ? "info" : "warn", nextProbe.found ? "Exporter detected." : "Exporter was not detected.");
  }

  async function checkRelease() {
    setCheckingRelease(true);
    try {
      const latest = await checkLatestExporterRelease();
      setRelease(latest);
      addLog("info", `Release ${latest.version} checked from GitHub.`);
    } catch (error) {
      addLog("error", error instanceof Error ? error.message : "Release lookup failed.");
    } finally {
      setCheckingRelease(false);
    }
  }

  async function installOrUpdateExporter() {
    setInstallingExporter(true);
    try {
      const result = await installLatestExporter();
      setRelease(result.release);
      setProbe(result.probe);
      setManagedState(result.state);
      addLog("info", `Installed imessage-exporter ${result.release.version} from ${result.assetName}.`);
    } catch (error) {
      addLog("error", error instanceof Error ? error.message : "Exporter install failed.");
    } finally {
      setInstallingExporter(false);
    }
  }

  function runExport() {
    if (dryRun) {
      addLog("info", `Dry run generated ${command.args.length} exporter arguments.`);
      return;
    }

    const translated = translateExporterError("Operation not permitted while opening ~/Library/Messages/chat.db");
    addLog("error", `${translated.title}: ${translated.suggestedFix}`);
  }

  function addLog(level: LogEntry["level"], message: string) {
    const time = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
    setLogs((current) => [{ time, level, message }, ...current].slice(0, 8));
  }

  return (
    <main className="app-shell">
      <nav className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark">
            <MessageSquareText aria-hidden="true" />
          </div>
          <div>
            <strong>ChatExportMate</strong>
            <span>local exporter</span>
          </div>
        </div>

        <div className="nav-group">
          <a className="nav-item is-active" href="#setup">
            <Settings2 aria-hidden="true" />
            Setup
          </a>
          <a className="nav-item" href="#export">
            <Archive aria-hidden="true" />
            Export
          </a>
          <a className="nav-item" href="#diagnostics">
            <Wrench aria-hidden="true" />
            Diagnostics
          </a>
          <a className="nav-item" href="#history">
            <History aria-hidden="true" />
            History
          </a>
        </div>

        <div className="sidebar-footer">
          <ShieldCheck aria-hidden="true" />
          <span>Local only</span>
        </div>
      </nav>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="section-kicker">Exporter ready</p>
            <h1>Guided iMessage export</h1>
          </div>
          <div className="topbar-status">
            <div className="status-cluster">
              <BadgeCheck aria-hidden="true" />
              <span>{probe.found ? probe.version ?? "detected" : "setup needed"}</span>
            </div>
            <div className="status-cluster">
              <DownloadCloud aria-hidden="true" />
              <span>{release ? `latest ${release.version}` : "release unchecked"}</span>
            </div>
            <div className="status-cluster">
              <Lock aria-hidden="true" />
              <span>Local only</span>
            </div>
          </div>
        </header>

        <section className="status-strip" aria-label="Workspace status">
          <div>
            <span>Exporter</span>
            <strong>{probe.found ? (probe.managed ? "Managed" : "Detected") : "Not installed"}</strong>
          </div>
          <div>
            <span>Platform</span>
            <strong>
              {snapshot.os} / {snapshot.arch}
            </strong>
          </div>
          <div>
            <span>Update</span>
            <strong>{updateAvailable ? "Available" : release ? "Current" : "Unchecked"}</strong>
          </div>
          <div>
            <span>Mode</span>
            <strong>{dryRun ? "Dry run" : "Export"}</strong>
          </div>
          <StatusPill
            label={issues.length === 0 && probe.found ? "Ready" : "Review"}
            state={issues.length === 0 && probe.found ? "passed" : "warning"}
          />
        </section>

        <div className="content-grid">
          <div className="main-stack">
            <div id="setup">
              <SetupChecklist items={diagnostics.slice(0, 4)} />
            </div>
            <div id="export">
              <ExportConfigurator
                canRun={issues.length === 0 && probe.found}
                dryRun={dryRun}
                onChange={setOptions}
                onDryRunChange={setDryRun}
                onRun={runExport}
                options={options}
              />
            </div>
            <CommandPreview command={command} issues={issues} />
          </div>

          <div id="diagnostics">
            <DiagnosticsPanel
              checkingRelease={checkingRelease}
              diagnostics={diagnostics}
              installActionLabel={installActionLabel}
              installingExporter={installingExporter}
              managedState={managedState}
              onCheckRelease={checkRelease}
              onInstallLatest={installOrUpdateExporter}
              onRunDiagnostics={runDiagnostics}
              release={release}
              selectedAsset={selectedAsset}
            />
          </div>
        </div>

        <div id="history">
          <LogTimeline entries={logs} />
        </div>
      </div>
    </main>
  );
}

export default App;
