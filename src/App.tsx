import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BadgeCheck,
  DownloadCloud,
  History,
  Info,
  Lock,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import "./App.css";
import { AboutPanel } from "./components/AboutPanel";
import { CommandPreview } from "./components/CommandPreview";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { ExportConfigurator } from "./components/ExportConfigurator";
import { type LogEntry, LogTimeline } from "./components/LogTimeline";
import { RunProgressPanel } from "./components/RunProgressPanel";
import { RunResultPanel } from "./components/RunResultPanel";
import { SetupChecklist } from "./components/SetupChecklist";
import { StatusPill } from "./components/StatusPill";
import { defaultExecutablePath, defaultExportOptions, initialLogEntries } from "./data/mockWorkspace";
import {
  buildDiagnosticCommand,
  buildExporterCommand,
  validateExportOptions,
} from "./domain/exporter/commandBuilder";
import { buildDiagnostics } from "./domain/exporter/diagnostics";
import {
  getInstallActionLabel,
  getReleaseStatusLabel,
  getUpdateStatusLabel,
} from "./domain/exporter/manager";
import {
  applyExportPreferences,
  createExportPreferences,
} from "./domain/exporter/preferences";
import { buildPermissionGuide } from "./domain/exporter/permissions";
import { buildExportPreflightSummary } from "./domain/exporter/preflight";
import {
  appendProcessOutputEvent,
  createProcessEventId,
  isProcessOutputForRun,
} from "./domain/exporter/processOutput";
import {
  detectRuntimeTarget,
  isUpdateAvailable,
  selectBestAsset,
} from "./domain/exporter/release";
import {
  createManagedOperationErrorSummary,
  createDryRunSummary,
  createRunBlockedSummary,
  summarizeManagedActivationResult,
  summarizeManagedInstallResult,
  summarizeDiagnosticRunResult,
  summarizeExportRunResult,
} from "./domain/exporter/runResults";
import type { RunSummary } from "./domain/exporter/runResults";
import {
  advanceRunProgress,
  completeRunProgress,
  failRunProgress,
  startRunProgress,
} from "./domain/exporter/runProgress";
import type { RunProgress } from "./domain/exporter/runProgress";
import { groupValidationIssues } from "./domain/exporter/validation";
import type {
  ExporterProbe,
  ExporterRelease,
  ManagedExporterState,
  OutputAccessCheck,
  ProcessOutputEvent,
  StoredLogEntry,
  SystemSnapshot,
} from "./domain/exporter/types";
import {
  activateManagedExporterVersion,
  checkOutputAccess,
  checkLatestExporterRelease,
  clearCustomExporterPath,
  createSupportBundle,
  detectExporter,
  executeExporter,
  getExporterManagementState,
  getSystemSnapshot,
  installLatestExporter,
  listExporterLogs,
  loadExportPreferences,
  openLocalPath,
  openOutputFolder,
  runExporterDiagnostics,
  saveExportPreferences,
  selectAttachmentFolder,
  selectBackupFolder,
  selectDatabaseFile,
  selectExporterBinary,
  selectOutputFolder,
  setCustomExporterPath,
  subscribeToProcessOutput,
} from "./services/tauriBridge";

function App() {
  const [options, setOptions] = useState(defaultExportOptions);
  const [dryRun, setDryRun] = useState(true);
  const [checkingRelease, setCheckingRelease] = useState(false);
  const [installingExporter, setInstallingExporter] = useState(false);
  const [checkingOutputAccess, setCheckingOutputAccess] = useState(false);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [activatingManagedVersion, setActivatingManagedVersion] = useState<string | null>(null);
  const [selectingCustomExporter, setSelectingCustomExporter] = useState(false);
  const [clearingCustomExporter, setClearingCustomExporter] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [creatingSupportBundle, setCreatingSupportBundle] = useState(false);
  const [loadingStoredLogs, setLoadingStoredLogs] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
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
  const [storedLogs, setStoredLogs] = useState<StoredLogEntry[]>([]);
  const [latestRunSummary, setLatestRunSummary] = useState<RunSummary | null>(null);
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null);
  const [processOutputEvents, setProcessOutputEvents] = useState<ProcessOutputEvent[]>([]);
  const [outputAccess, setOutputAccess] = useState<OutputAccessCheck>(
    previewOutputAccess(defaultExportOptions.outputPath),
  );
  const lastPreferenceSaveError = useRef<string | null>(null);
  const activeProcessEventId = useRef<string | null>(null);

  const executablePath = probe.path ?? defaultExecutablePath;
  const command = useMemo(() => buildExporterCommand(executablePath, options), [executablePath, options]);
  const diagnosticCommand = useMemo(
    () => buildDiagnosticCommand(executablePath, options),
    [executablePath, options],
  );
  const issues = useMemo(() => validateExportOptions(executablePath, options), [executablePath, options]);
  const issueMap = useMemo(() => groupValidationIssues(issues), [issues]);
  const target = useMemo(() => detectRuntimeTarget(snapshot), [snapshot]);
  const selectedAsset = useMemo(() => (release ? selectBestAsset(release, target) : null), [release, target]);
  const diagnostics = useMemo(
    () =>
      buildDiagnostics(
        snapshot,
        probe,
        release,
        target,
        executablePath,
        options,
        managedState,
        outputAccess,
      ),
    [executablePath, managedState, options, outputAccess, probe, release, snapshot, target],
  );
  const updateAvailable = release ? isUpdateAvailable(probe.version, release.version) : false;
  const installActionLabel = getInstallActionLabel(probe, updateAvailable);
  const releaseStatusLabel = getReleaseStatusLabel(checkingRelease, release?.version);
  const updateStatusLabel = getUpdateStatusLabel(
    checkingRelease,
    Boolean(release),
    updateAvailable,
    probe.found,
  );
  const preflight = useMemo(
    () => buildExportPreflightSummary(diagnostics, dryRun),
    [diagnostics, dryRun],
  );
  const permissionGuide = useMemo(
    () => buildPermissionGuide(snapshot, options, outputAccess),
    [options, outputAccess, snapshot],
  );

  useEffect(() => {
    void bootstrapWorkspace();
  }, []);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    void subscribeToProcessOutput((event) => {
      if (!isProcessOutputForRun(event, activeProcessEventId.current)) {
        return;
      }

      setProcessOutputEvents((currentEvents) =>
        appendProcessOutputEvent(currentEvents, event),
      );
    })
      .then((nextUnsubscribe) => {
        if (mounted) {
          unsubscribe = nextUnsubscribe;
          return;
        }

        nextUnsubscribe();
      })
      .catch((error) => {
        if (mounted) {
          addLog(
            "warn",
            error instanceof Error ? error.message : "Live process output is unavailable.",
          );
        }
      });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void refreshOutputAccess(options.outputPath);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [options.outputPath, preferencesLoaded]);

  useEffect(() => {
    if (!preferencesLoaded) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void persistExportPreferences();
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [dryRun, options, preferencesLoaded]);

  async function bootstrapWorkspace() {
    const startupOptions = await restoreExportPreferences();
    const healthCheckPromise = refreshHealthChecks(startupOptions.outputPath);
    const releasePromise = refreshLatestRelease(false);
    await Promise.all([healthCheckPromise, releasePromise, refreshStoredLogs(false)]);
    announceStartupReleaseStatus(await healthCheckPromise, await releasePromise);
    setPreferencesLoaded(true);
  }

  async function restoreExportPreferences(): Promise<typeof defaultExportOptions> {
    try {
      const preferences = await loadExportPreferences();
      const restored = applyExportPreferences(defaultExportOptions, true, preferences);
      setOptions(restored.options);
      setDryRun(restored.dryRun);
      if (preferences) {
        addLog("info", "Restored export preferences from local storage.");
      }
      return restored.options;
    } catch (error) {
      addLog("warn", error instanceof Error ? error.message : "Could not restore export preferences.");
      return defaultExportOptions;
    }
  }

  async function persistExportPreferences() {
    try {
      await saveExportPreferences(createExportPreferences(options, dryRun));
      lastPreferenceSaveError.current = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save export preferences.";
      if (lastPreferenceSaveError.current !== message) {
        lastPreferenceSaveError.current = message;
        addLog("warn", message);
      }
    }
  }

  async function refreshHealthChecks(outputPath = options.outputPath): Promise<ExporterProbe> {
    const [nextSnapshot, nextProbe, nextManagedState, nextOutputAccess] = await Promise.all([
      getSystemSnapshot(),
      detectExporter(),
      getExporterManagementState(),
      checkOutputAccess(outputPath),
    ]);
    setSnapshot(nextSnapshot);
    setProbe(nextProbe);
    setManagedState(nextManagedState);
    setOutputAccess(nextOutputAccess);
    addLog(nextProbe.found ? "info" : "warn", nextProbe.found ? "Exporter detected." : "Exporter was not detected.");
    return nextProbe;
  }

  async function runDiagnostics() {
    setRunningDiagnostics(true);
    clearProcessOutput();
    let eventId: string | null = null;
    let progress = startRunProgress("diagnostics");
    setRunProgress(progress);
    try {
      progress = advanceRunProgress(progress, "refresh-checks");
      setRunProgress(progress);
      const nextProbe = await refreshHealthChecks();
      if (!nextProbe.found) {
        const summary = createRunBlockedSummary({
          title: "Diagnostics need an exporter",
          explanation: "ChatExportMate cannot run upstream diagnostics until an exporter binary is available.",
          likelyCause: nextProbe.error ?? "imessage-exporter is not installed or was not found on PATH.",
          suggestedFix: "Install the managed exporter or select an existing imessage-exporter binary, then try again.",
          rawDetails: nextProbe.error ?? undefined,
          message: "Install or select imessage-exporter before running upstream diagnostics.",
        });
        setLatestRunSummary(summary);
        setRunProgress(failRunProgress(progress, "refresh-checks", summary.detail));
        addLog("warn", summary.message);
        return;
      }

      progress = advanceRunProgress(progress, "run-diagnostics");
      setRunProgress(progress);
      eventId = startProcessOutput("diagnostic");
      const result = await runExporterDiagnostics({
        ...diagnosticCommand,
        executablePath: nextProbe.path ?? diagnosticCommand.executablePath,
        eventId,
      });
      progress = advanceRunProgress(progress, "save-log");
      setRunProgress(progress);
      const summary = summarizeDiagnosticRunResult(result);
      setLatestRunSummary(summary);
      setRunProgress(
        result.success
          ? completeRunProgress(progress, "Diagnostics completed and the local log was saved.")
          : failRunProgress(progress, "run-diagnostics", summary.detail),
      );
      addLog(summary.level, summary.message);
      await refreshStoredLogs(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Diagnostics failed before they could start.";
      const summary = createRunBlockedSummary({
        title: "Diagnostics could not start",
        explanation: "ChatExportMate could not hand diagnostics to the desktop runtime.",
        likelyCause: detail,
        suggestedFix: "Refresh setup checks, confirm the exporter path, then run diagnostics again.",
        rawDetails: detail,
        message: detail,
      });
      setLatestRunSummary(summary);
      setRunProgress(failRunProgress(progress, "run-diagnostics", summary.detail));
      addLog("error", summary.message);
    } finally {
      stopProcessOutput(eventId);
      setRunningDiagnostics(false);
    }
  }

  async function checkRelease() {
    await refreshLatestRelease(true);
  }

  async function refreshLatestRelease(announce: boolean): Promise<ExporterRelease | null> {
    setCheckingRelease(true);
    try {
      const latest = await checkLatestExporterRelease();
      setRelease(latest);
      if (announce) {
        addLog("info", `Release ${latest.version} checked from GitHub.`);
      }
      return latest;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Release lookup failed.";
      addLog(announce ? "error" : "warn", message);
      return null;
    } finally {
      setCheckingRelease(false);
    }
  }

  function announceStartupReleaseStatus(nextProbe: ExporterProbe, latest: ExporterRelease | null) {
    if (!latest) {
      return;
    }

    if (isUpdateAvailable(nextProbe.version, latest.version)) {
      addLog("warn", `imessage-exporter ${latest.version} is available.`);
      return;
    }

    addLog("info", `Release ${latest.version} checked from GitHub.`);
  }

  async function installOrUpdateExporter() {
    setInstallingExporter(true);
    clearProcessOutput();
    let progress = startRunProgress("managed-install");
    setRunProgress(progress);
    try {
      progress = advanceRunProgress(progress, "download");
      setRunProgress(progress);
      const result = await installLatestExporter();
      progress = advanceRunProgress(progress, "verify");
      setRunProgress(progress);
      setRelease(result.release);
      setProbe(result.probe);
      setManagedState(result.state);
      const summary = summarizeManagedInstallResult(result);
      setLatestRunSummary(summary);
      setRunProgress(completeRunProgress(progress, summary.detail));
      addLog(summary.level, summary.message);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Exporter install failed.";
      const summary = createManagedOperationErrorSummary({
        title: "Exporter install failed",
        rawDetails: detail,
        suggestedFix: "Check the latest release, confirm network access, then try the managed install again.",
      });
      setLatestRunSummary(summary);
      setRunProgress(failRunProgress(progress, "download", summary.detail));
      addLog("error", summary.message);
    } finally {
      setInstallingExporter(false);
    }
  }

  async function activateManagedVersion(version: string) {
    setActivatingManagedVersion(version);
    clearProcessOutput();
    let progress = startRunProgress("managed-activation");
    setRunProgress(progress);
    try {
      progress = advanceRunProgress(progress, "verify");
      setRunProgress(progress);
      const result = await activateManagedExporterVersion(version);
      progress = advanceRunProgress(progress, "activate");
      setRunProgress(progress);
      setProbe(result.probe);
      setManagedState(result.state);
      const summary = summarizeManagedActivationResult(version, result);
      setLatestRunSummary(summary);
      setRunProgress(completeRunProgress(progress, summary.detail));
      addLog(summary.level, summary.message);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Managed exporter rollback failed.";
      const summary = createManagedOperationErrorSummary({
        title: "Managed exporter rollback failed",
        rawDetails: detail,
        suggestedFix: "Choose another stored version or reinstall the latest managed exporter.",
      });
      setLatestRunSummary(summary);
      setRunProgress(failRunProgress(progress, "verify", summary.detail));
      addLog("error", summary.message);
    } finally {
      setActivatingManagedVersion(null);
    }
  }

  async function selectExistingExporter() {
    setSelectingCustomExporter(true);
    try {
      const selectedPath = await selectExporterBinary();
      if (!selectedPath) {
        return;
      }

      const nextProbe = await setCustomExporterPath(selectedPath);
      setProbe(nextProbe);
      addLog(
        "info",
        `Selected imessage-exporter ${nextProbe.version ?? "unknown version"} from ${nextProbe.path ?? selectedPath}.`,
      );
    } catch (error) {
      addLog("error", error instanceof Error ? error.message : "Could not select an exporter binary.");
    } finally {
      setSelectingCustomExporter(false);
    }
  }

  async function forgetSelectedExporter() {
    setClearingCustomExporter(true);
    try {
      const nextProbe = await clearCustomExporterPath();
      setProbe(nextProbe);
      addLog(
        nextProbe.found ? "info" : "warn",
        nextProbe.found
          ? `Cleared selected exporter. Detection now uses ${nextProbe.source ?? "available"} exporter.`
          : "Cleared selected exporter. Install or select imessage-exporter before exporting.",
      );
    } catch (error) {
      addLog("error", error instanceof Error ? error.message : "Could not clear the selected exporter.");
    } finally {
      setClearingCustomExporter(false);
    }
  }

  async function runExport() {
    clearProcessOutput();
    if (dryRun) {
      const progress = startRunProgress("dry-run");
      const summary = createDryRunSummary(command.args.length);
      setLatestRunSummary(summary);
      setRunProgress(completeRunProgress(progress, summary.detail));
      addLog(summary.level, summary.message);
      return;
    }

    setIsExporting(true);
    let eventId: string | null = null;
    let progress = startRunProgress("export");
    setRunProgress(progress);
    try {
      progress = advanceRunProgress(progress, "output-access");
      setRunProgress(progress);
      const nextOutputAccess = await refreshOutputAccess(options.outputPath);
      if (!nextOutputAccess.writable) {
        const summary = createRunBlockedSummary({
          title: "Output folder is not writable",
          explanation: "ChatExportMate could not verify write access before starting the exporter.",
          likelyCause: nextOutputAccess.detail,
          suggestedFix: "Choose a writable output folder or grant file access, then start the export again.",
          rawDetails: nextOutputAccess.error ?? nextOutputAccess.detail,
          message: `Output access check failed. ${nextOutputAccess.detail}`,
        });
        setLatestRunSummary(summary);
        setRunProgress(failRunProgress(progress, "output-access", summary.detail));
        addLog(summary.level, summary.message);
        return;
      }

      progress = advanceRunProgress(progress, "run-exporter");
      setRunProgress(progress);
      eventId = startProcessOutput("export");
      const result = await executeExporter({
        ...command,
        eventId,
        outputPath: options.outputPath,
      });
      progress = advanceRunProgress(progress, "save-log");
      setRunProgress(progress);
      const summary = summarizeExportRunResult(result);
      setLatestRunSummary(summary);
      setRunProgress(
        result.success
          ? completeRunProgress(progress, "Export completed and the local run log was saved.")
          : failRunProgress(progress, "run-exporter", summary.detail),
      );
      addLog(summary.level, summary.message);
      await refreshStoredLogs(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Export failed before it could start.";
      const summary = createRunBlockedSummary({
        title: "Export could not start",
        explanation: "ChatExportMate could not hand the export to the desktop runtime.",
        likelyCause: detail,
        suggestedFix: "Refresh setup checks, confirm the exporter and output folder, then start the export again.",
        rawDetails: detail,
        message: detail,
      });
      setLatestRunSummary(summary);
      setRunProgress(failRunProgress(progress, "run-exporter", summary.detail));
      addLog("error", summary.message);
    } finally {
      stopProcessOutput(eventId);
      setIsExporting(false);
    }
  }

  async function openExportFolder() {
    try {
      await openOutputFolder(options.outputPath);
      addLog("info", `Opened ${options.outputPath}.`);
    } catch (error) {
      addLog("warn", error instanceof Error ? error.message : "Could not open the output folder.");
    }
  }

  async function openLatestRunOutput(path: string) {
    try {
      await openOutputFolder(path);
      addLog("info", `Opened ${path}.`);
    } catch (error) {
      addLog("warn", error instanceof Error ? error.message : "Could not open the exported folder.");
    }
  }

  async function openLatestRunLog(path: string) {
    try {
      await openLocalPath(path);
      addLog("info", `Opened ${path}.`);
    } catch (error) {
      addLog("warn", error instanceof Error ? error.message : "Could not open the latest run log.");
    }
  }

  async function pickOutputFolder() {
    await pickPath(selectOutputFolder, "outputPath", "Output folder selected.");
  }

  async function pickSourcePath() {
    await pickPath(
      options.platform === "iOS" ? selectBackupFolder : selectDatabaseFile,
      "databasePath",
      options.platform === "iOS" ? "iPhone backup folder selected." : "Messages database selected.",
    );
  }

  async function pickAttachmentRoot() {
    await pickPath(selectAttachmentFolder, "attachmentRoot", "Attachments folder selected.");
  }

  async function pickPath(
    picker: () => Promise<string | null>,
    field: "attachmentRoot" | "databasePath" | "outputPath",
    message: string,
  ) {
    try {
      const selectedPath = await picker();
      if (!selectedPath) {
        return;
      }

      setOptions((current) => ({ ...current, [field]: selectedPath }));
      addLog("info", message);
    } catch (error) {
      addLog("warn", error instanceof Error ? error.message : "Could not open the file picker.");
    }
  }

  async function refreshStoredLogs(announce = true) {
    setLoadingStoredLogs(true);
    try {
      const nextLogs = await listExporterLogs();
      setStoredLogs(nextLogs);
      if (announce) {
        addLog("info", `Loaded ${nextLogs.length} saved local log${nextLogs.length === 1 ? "" : "s"}.`);
      }
    } catch (error) {
      addLog("warn", error instanceof Error ? error.message : "Could not load saved local logs.");
    } finally {
      setLoadingStoredLogs(false);
    }
  }

  async function refreshOutputAccess(outputPath: string): Promise<OutputAccessCheck> {
    const nextOutputAccess = await checkOutputAccess(outputPath);
    setOutputAccess(nextOutputAccess);
    return nextOutputAccess;
  }

  async function checkCurrentOutputAccess() {
    setCheckingOutputAccess(true);
    try {
      const nextOutputAccess = await refreshOutputAccess(options.outputPath);
      addLog(nextOutputAccess.writable ? "info" : "warn", nextOutputAccess.detail);
    } catch (error) {
      addLog("warn", error instanceof Error ? error.message : "Could not check output folder access.");
    } finally {
      setCheckingOutputAccess(false);
    }
  }

  async function openStoredLog(log: StoredLogEntry) {
    try {
      await openLocalPath(log.path);
      addLog("info", `Opened ${log.fileName}.`);
    } catch (error) {
      addLog("warn", error instanceof Error ? error.message : "Could not open the selected log.");
    }
  }

  async function exportSupportBundle() {
    setCreatingSupportBundle(true);
    try {
      const bundle = await createSupportBundle();
      addLog("info", `Created support bundle with ${bundle.logCount} log${bundle.logCount === 1 ? "" : "s"}.`);
      await openLocalPath(bundle.bundlePath);
      addLog("info", `Opened ${bundle.bundlePath}.`);
    } catch (error) {
      addLog("warn", error instanceof Error ? error.message : "Could not create the support bundle.");
    } finally {
      setCreatingSupportBundle(false);
    }
  }

  function addLog(level: LogEntry["level"], message: string) {
    const time = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
    setLogs((current) => [{ time, level, message }, ...current].slice(0, 8));
  }

  function clearProcessOutput() {
    activeProcessEventId.current = null;
    setProcessOutputEvents([]);
  }

  function startProcessOutput(kind: ProcessOutputEvent["kind"]): string {
    const eventId = createProcessEventId(kind);
    activeProcessEventId.current = eventId;
    setProcessOutputEvents([]);
    return eventId;
  }

  function stopProcessOutput(eventId: string | null) {
    if (eventId && activeProcessEventId.current === eventId) {
      activeProcessEventId.current = null;
    }
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
          <a className="nav-item" href="#about">
            <Info aria-hidden="true" />
            About
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
              <span>{releaseStatusLabel}</span>
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
            <strong>{updateStatusLabel}</strong>
          </div>
          <div>
            <span>Mode</span>
            <strong>{dryRun ? "Dry run" : "Export"}</strong>
          </div>
          <StatusPill
            label={preflight.canRunExport ? "Ready" : "Review"}
            state={preflight.canRunExport ? "passed" : "warning"}
          />
        </section>

        <div className="content-grid">
          <div className="main-stack">
            <div id="setup">
              <SetupChecklist items={diagnostics.slice(0, 4)} permissions={permissionGuide} />
            </div>
            <div id="export">
              <ExportConfigurator
                checkingOutputAccess={checkingOutputAccess}
                dryRun={dryRun}
                isPreparingExporter={installingExporter}
                isRunning={isExporting}
                issueMap={issueMap}
                onCheckOutputAccess={checkCurrentOutputAccess}
                onChange={setOptions}
                onDryRunChange={setDryRun}
                onOpenOutput={openExportFolder}
                onPrepareExporter={installOrUpdateExporter}
                onPickAttachmentRoot={pickAttachmentRoot}
                onPickOutput={pickOutputFolder}
                onPickSource={pickSourcePath}
                onRun={runExport}
                options={options}
                preflight={preflight}
              />
            </div>
            <RunProgressPanel outputEvents={processOutputEvents} progress={runProgress} />
            <CommandPreview command={command} issues={issues} />
            <RunResultPanel
              onOpenLog={openLatestRunLog}
              onOpenOutput={openLatestRunOutput}
              summary={latestRunSummary}
            />
          </div>

          <div id="diagnostics">
            <DiagnosticsPanel
              activatingManagedVersion={activatingManagedVersion}
              checkingRelease={checkingRelease}
              diagnostics={diagnostics}
              installActionLabel={installActionLabel}
              installingExporter={installingExporter}
              onActivateManagedVersion={activateManagedVersion}
              clearingCustomExporter={clearingCustomExporter}
              managedState={managedState}
              onClearCustomExporter={forgetSelectedExporter}
              onCheckRelease={checkRelease}
              onInstallLatest={installOrUpdateExporter}
              onRunDiagnostics={runDiagnostics}
              onSelectCustomExporter={selectExistingExporter}
              probe={probe}
              release={release}
              runningDiagnostics={runningDiagnostics}
              selectingCustomExporter={selectingCustomExporter}
              selectedAsset={selectedAsset}
            />
          </div>
        </div>

        <div id="history">
          <LogTimeline
            creatingSupportBundle={creatingSupportBundle}
            entries={logs}
            loadingStoredLogs={loadingStoredLogs}
            onCreateSupportBundle={exportSupportBundle}
            onOpenStoredLog={openStoredLog}
            onRefreshStoredLogs={() => void refreshStoredLogs()}
            storedLogs={storedLogs}
          />
        </div>

        <div id="about">
          <AboutPanel />
        </div>
      </div>
    </main>
  );
}

function previewOutputAccess(outputPath: string): OutputAccessCheck {
  return {
    path: outputPath,
    resolvedPath: outputPath,
    writable: false,
    checkedAt: "",
    detail: "Desktop write access check has not run.",
    error: null,
  };
}

export default App;
