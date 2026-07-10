import { useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, History, Info, MessageSquareText, Wrench } from "lucide-react";
import "./App.css";
import { AboutDialog } from "./components/AboutDialog";
import { ActivityDrawer } from "./components/drawers/ActivityDrawer";
import { ToolDrawer } from "./components/drawers/ToolDrawer";
import { AdvancedOptions } from "./components/flow/AdvancedOptions";
import { ArchivePreviewCard, type ExportStage } from "./components/flow/ArchivePreviewCard";
import { DestinationCard } from "./components/flow/DestinationCard";
import { FormatCard } from "./components/flow/FormatCard";
import { SourceCard } from "./components/flow/SourceCard";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { SourcePickerDialog } from "./components/SourcePickerDialog";
import { ToastStack, type ToastLevel, type ToastMessage } from "./components/Toast";
import { defaultExecutablePath, defaultExportOptions } from "./data/mockWorkspace";
import {
  buildDiagnosticCommand,
  buildExporterCommand,
  usesStructuredCsvExport,
  validateExportOptions,
} from "./domain/exporter/commandBuilder";
import { buildDiagnostics } from "./domain/exporter/diagnostics";
import { getInstallActionLabel } from "./domain/exporter/manager";
import {
  alignSourcePlatformToHost,
  shouldShowMacSourceChoice,
} from "./domain/exporter/platformDefaults";
import {
  normalizeLocalPathForDisplay,
  normalizeOptionalLocalPathForDisplay,
} from "./domain/exporter/paths";
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
import { groupValidationIssues, validationMessagesFor } from "./domain/exporter/validation";
import type {
  ExportOptions,
  ExportPlatform,
  ExporterProbe,
  ExporterRelease,
  IphoneBackupCandidate,
  ManagedExporterState,
  OutputAccessCheck,
  ProcessOutputEvent,
  StoredLogDetail,
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
  getStoredLogDetail,
  installLatestExporter,
  listIphoneBackups,
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
import {
  appName,
  appSubtitle,
  applyEditionDefaults,
  enforceEditionOptions,
  isSpenlioEdition,
} from "./appEdition";
import {
  applyExportPreferences,
  createExportPreferences,
} from "./domain/exporter/preferences";
import { hasCompletedOnboarding, markOnboardingComplete } from "./onboardingState";

const editionDefaultExportOptions = applyEditionDefaults(defaultExportOptions);

function App() {
  const [onboarded, setOnboarded] = useState(hasCompletedOnboarding);
  const [options, setOptions] = useState(editionDefaultExportOptions);
  const [backupPassword, setBackupPassword] = useState("");
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [toolDrawerOpen, setToolDrawerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [exportStage, setExportStage] = useState<ExportStage>("configure");
  const [checkingRelease, setCheckingRelease] = useState(false);
  const [installingExporter, setInstallingExporter] = useState(false);
  const [checkingOutputAccess, setCheckingOutputAccess] = useState(false);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [activatingManagedVersion, setActivatingManagedVersion] = useState<string | null>(null);
  const [selectingCustomExporter, setSelectingCustomExporter] = useState(false);
  const [clearingCustomExporter, setClearingCustomExporter] = useState(false);
  const [creatingSupportBundle, setCreatingSupportBundle] = useState(false);
  const [loadingStoredLogs, setLoadingStoredLogs] = useState(false);
  const [loadingLogDetail, setLoadingLogDetail] = useState(false);
  const [loadingBackupCandidates, setLoadingBackupCandidates] = useState(false);
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
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [storedLogs, setStoredLogs] = useState<StoredLogEntry[]>([]);
  const [backupCandidates, setBackupCandidates] = useState<IphoneBackupCandidate[]>([]);
  const [selectedLogDetail, setSelectedLogDetail] = useState<StoredLogDetail | null>(null);
  const [exportSummary, setExportSummary] = useState<RunSummary | null>(null);
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null);
  const [processOutputEvents, setProcessOutputEvents] = useState<ProcessOutputEvent[]>([]);
  const [outputAccess, setOutputAccess] = useState<OutputAccessCheck>(
    previewOutputAccess(editionDefaultExportOptions.outputPath),
  );
  const lastPreferenceSaveError = useRef<string | null>(null);
  const activeProcessEventId = useRef<string | null>(null);
  const toastId = useRef(0);

  const executablePath = probe.path ?? defaultExecutablePath;
  const structuredCsvExport = useMemo(() => usesStructuredCsvExport(options), [options]);
  const diagnosticCommand = useMemo(
    () => buildDiagnosticCommand(executablePath, options),
    [executablePath, options],
  );
  const runtimeSecrets = useMemo(() => ({ backupPassword }), [backupPassword]);
  const issues = useMemo(
    () => validateExportOptions(executablePath, options, runtimeSecrets),
    [executablePath, options, runtimeSecrets],
  );
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
        runtimeSecrets,
      ),
    [executablePath, managedState, options, outputAccess, probe, release, runtimeSecrets, snapshot, target],
  );
  const updateAvailable = release ? isUpdateAvailable(probe.version, release.version) : false;
  const installActionLabel = getInstallActionLabel(probe, updateAvailable);
  const preflightSansTool = useMemo(
    () => buildExportPreflightSummary(diagnostics, false, false),
    [diagnostics],
  );
  const fileManagerLabel = useMemo(() => getFileManagerLabel(snapshot), [snapshot]);
  const selectedSourcePath = normalizeOptionalLocalPathForDisplay(options.databasePath).trim();
  const selectedOutputPath =
    outputAccess.path === options.outputPath
      ? normalizeLocalPathForDisplay(outputAccess.resolvedPath || options.outputPath)
      : normalizeLocalPathForDisplay(options.outputPath);
  const showMacSourceChoice = !isSpenlioEdition && shouldShowMacSourceChoice(snapshot);

  const toolInstallNeeded = !structuredCsvExport && !probe.found;
  const canAutoInstallTool = Boolean(selectedAsset);
  const canStartExport =
    preflightSansTool.canRunExport && (!toolInstallNeeded || canAutoInstallTool);
  const isPreviewHarness = snapshot.family === "browser-preview";
  const startLabel = isSpenlioEdition ? "Create CSV" : "Export messages";
  const commandPreview = useMemo(
    () =>
      structuredCsvExport ? null : buildExporterCommand(executablePath, options).displayCommand,
    [executablePath, options, structuredCsvExport],
  );
  const nextAction = getNextAction({
    canStartExport,
    hasConfigIssues: issues.some(
      (issue) => !["executablePath", "databasePath", "backupPassword"].includes(issue.field),
    ),
    isPreviewHarness,
    needsBackupPassword: validationMessagesFor(issueMap, "backupPassword").length > 0,
    outputPathChosen: Boolean(selectedOutputPath),
    outputWritable: outputAccess.writable,
    sourceChosen: Boolean(selectedSourcePath),
    toolUnavailable: toolInstallNeeded && !canAutoInstallTool,
  });

  useEffect(() => {
    document.title = appName;
  }, []);

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
      .catch(() => {
        // Live output is a nicety; exports still work without it.
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
      setCheckingOutputAccess(true);
      void refreshOutputAccess(options.outputPath).finally(() => setCheckingOutputAccess(false));
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
  }, [options, preferencesLoaded]);

  function notify(level: ToastLevel, message: string) {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-2), { id, level, message }]);
    window.setTimeout(() => dismissToast(id), 6500);
  }

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  async function bootstrapWorkspace() {
    const startupSnapshot = await getSystemSnapshot();
    setSnapshot(startupSnapshot);
    const startupOptions = await restoreExportPreferences(startupSnapshot);
    const healthCheckPromise = refreshHealthChecks(startupOptions.outputPath, startupSnapshot);
    const releasePromise = refreshLatestRelease(false);
    await Promise.all([
      healthCheckPromise,
      releasePromise,
      refreshStoredLogs(false),
      refreshIphoneBackups(false),
    ]);
    announceStartupReleaseStatus(await healthCheckPromise, await releasePromise);
    setPreferencesLoaded(true);
  }

  async function restoreExportPreferences(
    hostSnapshot: SystemSnapshot,
  ): Promise<typeof editionDefaultExportOptions> {
    try {
      const preferences = await loadExportPreferences();
      const restored = applyExportPreferences(editionDefaultExportOptions, false, preferences);
      const alignedOptions = normalizeExportOptionPaths(enforceEditionOptions(
        alignSourcePlatformToHost(restored.options, hostSnapshot),
      ));
      setOptions(alignedOptions);
      return alignedOptions;
    } catch (error) {
      const alignedOptions = normalizeExportOptionPaths(enforceEditionOptions(
        alignSourcePlatformToHost(editionDefaultExportOptions, hostSnapshot),
      ));
      setOptions(alignedOptions);
      notify("warn", error instanceof Error ? error.message : "Could not restore your last settings.");
      return alignedOptions;
    }
  }

  async function persistExportPreferences() {
    try {
      await saveExportPreferences(createExportPreferences(options, false));
      lastPreferenceSaveError.current = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save your settings.";
      if (lastPreferenceSaveError.current !== message) {
        lastPreferenceSaveError.current = message;
        notify("warn", message);
      }
    }
  }

  async function refreshHealthChecks(
    outputPath = options.outputPath,
    knownSnapshot?: SystemSnapshot,
  ): Promise<ExporterProbe> {
    const [nextSnapshot, nextProbe, nextManagedState, nextOutputAccess] = await Promise.all([
      knownSnapshot ? Promise.resolve(knownSnapshot) : getSystemSnapshot(),
      detectExporter(),
      getExporterManagementState(),
      checkOutputAccess(outputPath),
    ]);
    setSnapshot(nextSnapshot);
    setProbe(nextProbe);
    setManagedState(nextManagedState);
    setOutputAccess(nextOutputAccess);
    return nextProbe;
  }

  function announceStartupReleaseStatus(nextProbe: ExporterProbe, latest: ExporterRelease | null) {
    if (isSpenlioEdition || !latest || !nextProbe.found) {
      return;
    }

    if (isUpdateAvailable(nextProbe.version, latest.version)) {
      notify("info", `A newer export tool (${latest.version}) is available in the Export tool panel.`);
    }
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
        setRunProgress(
          failRunProgress(
            progress,
            "refresh-checks",
            "The check-up needs the export tool. Install it first, then run the check-up again.",
          ),
        );
        notify("warn", "Install the export tool before running a full check-up.");
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
      setRunProgress(
        result.success
          ? completeRunProgress(progress, "Check-up finished. Details were saved to Activity.")
          : failRunProgress(progress, "run-diagnostics", summary.detail),
      );
      notify(summary.level, summary.message);
      await refreshStoredLogs(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The check-up could not start.";
      setRunProgress(failRunProgress(progress, "run-diagnostics", detail));
      notify("error", detail);
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
        notify("info", `Latest export tool release: ${latest.version}.`);
      }
      return latest;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not check for a new version.";
      if (announce) {
        notify("error", message);
      }
      return null;
    } finally {
      setCheckingRelease(false);
    }
  }

  async function installOrUpdateExporter(): Promise<ExporterProbe | null> {
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
      setRunProgress(completeRunProgress(progress, summary.detail));
      notify(summary.level, summary.message);
      return result.probe;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The export tool could not be installed.";
      setRunProgress(failRunProgress(progress, "download", detail));
      notify("error", detail);
      return null;
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
      setRunProgress(completeRunProgress(progress, summary.detail));
      notify(summary.level, summary.message);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Could not switch tool versions.";
      setRunProgress(failRunProgress(progress, "verify", detail));
      notify("error", detail);
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
      notify(
        "info",
        `Using imessage-exporter ${nextProbe.version ?? "unknown version"} from your file.`,
      );
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not use that file.");
    } finally {
      setSelectingCustomExporter(false);
    }
  }

  async function forgetSelectedExporter() {
    setClearingCustomExporter(true);
    try {
      const nextProbe = await clearCustomExporterPath();
      setProbe(nextProbe);
      notify(
        nextProbe.found ? "info" : "warn",
        nextProbe.found
          ? "Back to the app-managed export tool."
          : "Selected tool forgotten. The tool will install automatically with the next export.",
      );
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not forget the selected tool.");
    } finally {
      setClearingCustomExporter(false);
    }
  }

  async function startExportFlow() {
    setExportSummary(null);
    setExportStage("running");

    let exporterPathForRun = executablePath;
    if (toolInstallNeeded) {
      const installedProbe = await installOrUpdateExporter();
      if (!installedProbe?.found) {
        setExportSummary(
          createRunBlockedSummary({
            title: "The export tool could not be set up",
            explanation: "The export needs a small local helper tool, and setting it up did not finish.",
            likelyCause: "The download failed or the downloaded tool could not be verified.",
            suggestedFix: "Check your internet connection and try again. You can also manage the tool from the Export tool panel.",
            message: "The export tool could not be set up.",
          }),
        );
        setExportStage("failed");
        return;
      }
      exporterPathForRun = installedProbe.path ?? exporterPathForRun;
    }

    const succeeded = await runExport(exporterPathForRun);
    setExportStage(succeeded ? "success" : "failed");
  }

  async function runExport(exporterPathForRun: string): Promise<boolean> {
    clearProcessOutput();
    const runCommand = buildExporterCommand(exporterPathForRun, options);
    let eventId: string | null = null;
    let progress = startRunProgress("export");
    setRunProgress(progress);
    try {
      progress = advanceRunProgress(progress, "output-access");
      setRunProgress(progress);
      const nextOutputAccess = await refreshOutputAccess(options.outputPath);
      if (!nextOutputAccess.writable) {
        const summary = createRunBlockedSummary({
          title: "That folder cannot be written to",
          explanation: "The save folder was checked right before exporting and files cannot be created there.",
          likelyCause: nextOutputAccess.detail,
          suggestedFix: "Choose a different save folder, or allow file access, then export again.",
          rawDetails: nextOutputAccess.error ?? nextOutputAccess.detail,
          message: `The save folder is not writable. ${nextOutputAccess.detail}`,
        });
        setExportSummary(summary);
        setRunProgress(failRunProgress(progress, "output-access", summary.detail));
        return false;
      }

      progress = advanceRunProgress(progress, "run-exporter");
      setRunProgress(progress);
      eventId = startProcessOutput("export");
      const result = await executeExporter({
        ...runCommand,
        eventId,
        outputPath: options.outputPath,
        platform: options.platform,
        sourcePath: options.databasePath,
        startDate: options.startDate,
        endDate: options.endDate,
        conversationFilter: options.conversationFilter,
        backupPassword:
          options.platform === "iOS" && options.encryptedBackup ? backupPassword : undefined,
      });
      progress = advanceRunProgress(progress, "save-log");
      setRunProgress(progress);
      const summary = summarizeExportRunResult(result);
      setExportSummary(summary);
      setRunProgress(
        result.success
          ? completeRunProgress(progress, "Your export is ready.")
          : failRunProgress(progress, "run-exporter", summary.detail),
      );
      await refreshStoredLogs(false);
      return result.success;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The export could not start.";
      const summary = createRunBlockedSummary({
        title: "The export could not start",
        explanation: "Something stopped the export before it began.",
        likelyCause: detail,
        suggestedFix: "Check the source and save folder, then export again.",
        rawDetails: detail,
        message: detail,
      });
      setExportSummary(summary);
      setRunProgress(failRunProgress(progress, "run-exporter", summary.detail));
      return false;
    } finally {
      stopProcessOutput(eventId);
      if (options.encryptedBackup) {
        setBackupPassword("");
      }
    }
  }

  function resetExportStage() {
    setExportStage("configure");
    setExportSummary(null);
    setRunProgress(null);
  }

  async function openExportFolder() {
    try {
      await openOutputFolder(options.outputPath);
    } catch (error) {
      notify("warn", error instanceof Error ? error.message : "Could not open the save folder.");
    }
  }

  async function openSelectedSourceLocation() {
    const sourcePath = sourceLocationPathForOpen(options);
    if (!sourcePath) {
      return;
    }

    try {
      await openLocalPath(sourcePath);
    } catch (error) {
      notify("warn", error instanceof Error ? error.message : "Could not open the source location.");
    }
  }

  async function openLatestRunOutput(path: string) {
    try {
      await openOutputFolder(path);
    } catch (error) {
      notify("warn", error instanceof Error ? error.message : "Could not open the exported folder.");
    }
  }

  async function openLatestRunLog(path: string) {
    try {
      await openLocalPath(path);
    } catch (error) {
      notify("warn", error instanceof Error ? error.message : "Could not open the details file.");
    }
  }

  async function pickOutputFolder() {
    await pickPath(selectOutputFolder, "outputPath");
  }

  function openSourcePicker() {
    setSourcePickerOpen(true);
    void refreshIphoneBackups(false);
  }

  async function pickIphoneBackupSource() {
    setSourcePickerOpen(false);
    await pickSourcePath("iOS");
  }

  async function pickMacMessagesSource() {
    setSourcePickerOpen(false);
    await pickSourcePath("macOS");
  }

  async function pickSourcePath(platform: ExportPlatform) {
    await pickPath(
      platform === "iOS" ? selectBackupFolder : selectDatabaseFile,
      "databasePath",
      (current) => ({
        ...current,
        platform,
        encryptedBackup: platform === "iOS" ? current.encryptedBackup : false,
        attachmentRoot: platform === "iOS" ? "" : current.attachmentRoot,
      }),
    );
  }

  function chooseDetectedIphoneBackup(candidate: IphoneBackupCandidate) {
    const selectedPath = candidate.resolvedPath ?? candidate.path;
    setBackupPassword("");
    setOptions((current) => ({
      ...current,
      platform: "iOS",
      databasePath: normalizeLocalPathForDisplay(selectedPath),
      attachmentRoot: "",
    }));
    setSourcePickerOpen(false);
  }

  async function pickAttachmentRoot() {
    await pickPath(selectAttachmentFolder, "attachmentRoot");
  }

  async function pickPath(
    picker: () => Promise<string | null>,
    field: "attachmentRoot" | "databasePath" | "outputPath",
    updateBeforeSave?: (current: ExportOptions) => ExportOptions,
  ) {
    try {
      const selectedPath = await picker();
      if (!selectedPath) {
        return;
      }

      if (field === "databasePath") {
        setBackupPassword("");
      }
      setOptions((current) => ({
        ...(updateBeforeSave ? updateBeforeSave(current) : current),
        [field]: normalizeLocalPathForDisplay(selectedPath),
      }));
    } catch (error) {
      notify("warn", error instanceof Error ? error.message : "Could not open the folder picker.");
    }
  }

  async function refreshIphoneBackups(announce = true) {
    setLoadingBackupCandidates(true);
    try {
      const nextCandidates = await listIphoneBackups();
      setBackupCandidates(nextCandidates);
      if (announce) {
        notify(
          nextCandidates.length > 0 ? "info" : "warn",
          nextCandidates.length > 0
            ? `Found ${nextCandidates.length} iPhone backup${nextCandidates.length === 1 ? "" : "s"} on this computer.`
            : "No iPhone backup was found in Apple's usual folders.",
        );
      }
    } catch (error) {
      if (announce) {
        notify("warn", error instanceof Error ? error.message : "Could not scan for backups.");
      }
    } finally {
      setLoadingBackupCandidates(false);
    }
  }

  async function refreshStoredLogs(announce = true) {
    setLoadingStoredLogs(true);
    try {
      const nextLogs = await listExporterLogs();
      setStoredLogs(nextLogs);
      setSelectedLogDetail((current) =>
        current && nextLogs.some((log) => log.id === current.entry.id) ? current : null,
      );
      if (announce) {
        notify("info", `Loaded ${nextLogs.length} saved run${nextLogs.length === 1 ? "" : "s"}.`);
      }
    } catch (error) {
      notify("warn", error instanceof Error ? error.message : "Could not load past activity.");
    } finally {
      setLoadingStoredLogs(false);
    }
  }

  async function refreshOutputAccess(outputPath: string): Promise<OutputAccessCheck> {
    const nextOutputAccess = await checkOutputAccess(outputPath);
    setOutputAccess(nextOutputAccess);
    return nextOutputAccess;
  }

  function handleOptionsChange(nextOptions: ExportOptions) {
    const editionOptions = normalizeExportOptionPaths(enforceEditionOptions(nextOptions));
    if (shouldClearBackupPassword(options, editionOptions)) {
      setBackupPassword("");
    }
    setOptions(editionOptions);
  }

  function handleEncryptedBackupChange(encryptedBackup: boolean) {
    handleOptionsChange({
      ...options,
      encryptedBackup,
    });
  }

  async function openStoredLog(log: StoredLogEntry) {
    try {
      await openLocalPath(log.path);
    } catch (error) {
      notify("warn", error instanceof Error ? error.message : "Could not open that log.");
    }
  }

  async function previewStoredLog(log: StoredLogEntry) {
    setLoadingLogDetail(true);
    try {
      const detail = await getStoredLogDetail(log);
      setSelectedLogDetail(detail);
    } catch (error) {
      notify("warn", error instanceof Error ? error.message : "Could not preview that log.");
    } finally {
      setLoadingLogDetail(false);
    }
  }

  async function exportSupportBundle() {
    setCreatingSupportBundle(true);
    try {
      const bundle = await createSupportBundle();
      notify("info", `Support bundle created with ${bundle.logCount} log${bundle.logCount === 1 ? "" : "s"}.`);
      await openLocalPath(bundle.bundlePath);
    } catch (error) {
      notify("warn", error instanceof Error ? error.message : "Could not create the support bundle.");
    } finally {
      setCreatingSupportBundle(false);
    }
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

  function completeOnboarding() {
    markOnboardingComplete();
    setOnboarded(true);
  }

  if (!onboarded) {
    return (
      <>
        <OnboardingScreen
          appName={appName}
          onStart={completeOnboarding}
          spenlioEdition={isSpenlioEdition}
        />
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
      </>
    );
  }

  return (
    <>
      <div className="app-frame">
        <header className="toolbar">
          <div className="toolbar-brand">
            <div aria-hidden="true" className="brand-mark">
              <MessageSquareText />
            </div>
            <div className="toolbar-brand-copy">
              <strong>{appName}</strong>
              <span>{appSubtitle}</span>
            </div>
          </div>
          <div className="toolbar-actions">
            <button
              className="button button--ghost button--compact"
              onClick={() => setActivityOpen(true)}
              type="button"
            >
              <History aria-hidden="true" />
              Activity
            </button>
            {!isSpenlioEdition ? (
              <button
                className="button button--ghost button--compact"
                onClick={() => setToolDrawerOpen(true)}
                type="button"
              >
                <Wrench aria-hidden="true" />
                Export tool
              </button>
            ) : null}
            <button
              aria-label={`About ${appName}`}
              className="button button--ghost button--icon"
              onClick={() => setAboutOpen(true)}
              title={`About ${appName}`}
              type="button"
            >
              <Info aria-hidden="true" />
            </button>
          </div>
        </header>

        {snapshot.launch_warning ? (
          <section aria-label="Portable app warning" className="runtime-warning">
            <CircleAlert aria-hidden="true" />
            <div>
              <strong>Extract the portable app first</strong>
              <p>{snapshot.launch_warning}</p>
            </div>
          </section>
        ) : null}

        <main className="canvas">
          <div className="canvas-heading">
            <h1>{isSpenlioEdition ? "Create your Spenlio CSV" : "Save your messages"}</h1>
            <p>
              {isSpenlioEdition
                ? "Turn a local iPhone backup into a finance SMS spreadsheet — all on this computer."
                : "Turn an iPhone backup into files you can read and keep — all on this computer."}
            </p>
          </div>

          <div className="flow-layout">
            <div className={`flow-decisions ${exportStage === "running" ? "is-locked" : ""}`}>
              <SourceCard
                backupPassword={backupPassword}
                candidates={backupCandidates}
                encryptedBackup={options.encryptedBackup}
                fileManagerLabel={fileManagerLabel}
                issues={validationMessagesFor(issueMap, "databasePath")}
                loadingCandidates={loadingBackupCandidates || !preferencesLoaded}
                onBackupPasswordChange={setBackupPassword}
                onEncryptedBackupChange={handleEncryptedBackupChange}
                onOpenPicker={openSourcePicker}
                onOpenSource={openSelectedSourceLocation}
                onUseCandidate={chooseDetectedIphoneBackup}
                passwordIssues={validationMessagesFor(issueMap, "backupPassword")}
                platform={options.platform}
                sourcePath={selectedSourcePath}
                step={1}
              />

              {!isSpenlioEdition ? (
                <FormatCard
                  format={options.format}
                  onFormatChange={(format) => handleOptionsChange({ ...options, format })}
                />
              ) : null}

              <DestinationCard
                checking={checkingOutputAccess}
                detail={outputAccess.detail}
                fileManagerLabel={fileManagerLabel}
                issues={validationMessagesFor(issueMap, "outputPath")}
                onOpen={openExportFolder}
                onPick={pickOutputFolder}
                outputPath={selectedOutputPath}
                showAccessStatus={!isPreviewHarness}
                step={isSpenlioEdition ? 2 : 3}
                writable={outputAccess.writable}
              />

              <AdvancedOptions
                commandPreview={commandPreview}
                customNameIssues={validationMessagesFor(issueMap, "customName")}
                endDateIssues={validationMessagesFor(issueMap, "endDate")}
                onChange={handleOptionsChange}
                onPickAttachmentRoot={pickAttachmentRoot}
                options={options}
                spenlioEdition={isSpenlioEdition}
                startDateIssues={validationMessagesFor(issueMap, "startDate")}
              />
            </div>

            <ArchivePreviewCard
              canStart={canStartExport}
              nextAction={nextAction}
              onOpenLog={openLatestRunLog}
              onOpenOutput={openLatestRunOutput}
              onReset={resetExportStage}
              onStart={() => void startExportFlow()}
              options={options}
              outputEvents={processOutputEvents}
              progress={runProgress}
              stage={exportStage}
              startLabel={startLabel}
              summary={exportSummary}
              willInstallTool={toolInstallNeeded && canAutoInstallTool}
            />
          </div>
        </main>
      </div>

      {sourcePickerOpen ? (
        <SourcePickerDialog
          appName={appName}
          backupCandidates={backupCandidates}
          loadingBackupCandidates={loadingBackupCandidates}
          onChooseDetectedIphoneBackup={chooseDetectedIphoneBackup}
          onChooseIphoneBackup={() => void pickIphoneBackupSource()}
          onChooseMacDatabase={() => void pickMacMessagesSource()}
          onClose={() => setSourcePickerOpen(false)}
          onRefreshBackups={() => void refreshIphoneBackups(false)}
          showMacSourceChoice={showMacSourceChoice}
        />
      ) : null}

      {activityOpen ? (
        <ActivityDrawer
          creatingSupportBundle={creatingSupportBundle}
          loadingLogDetail={loadingLogDetail}
          loadingStoredLogs={loadingStoredLogs}
          onClose={() => setActivityOpen(false)}
          onCreateSupportBundle={() => void exportSupportBundle()}
          onOpenStoredLog={(log) => void openStoredLog(log)}
          onPreviewStoredLog={(log) => void previewStoredLog(log)}
          onRefreshStoredLogs={() => void refreshStoredLogs(false)}
          selectedLogDetail={selectedLogDetail}
          storedLogs={storedLogs}
        />
      ) : null}

      {toolDrawerOpen ? (
        <ToolDrawer
          activatingManagedVersion={activatingManagedVersion}
          checkingRelease={checkingRelease}
          clearingCustomExporter={clearingCustomExporter}
          diagnostics={diagnostics}
          installActionLabel={installActionLabel}
          installingExporter={installingExporter}
          managedState={managedState}
          onActivateManagedVersion={(version) => void activateManagedVersion(version)}
          onCheckRelease={() => void checkRelease()}
          onClearCustomExporter={() => void forgetSelectedExporter()}
          onClose={() => setToolDrawerOpen(false)}
          onInstallLatest={() => void installOrUpdateExporter()}
          onRunDiagnostics={() => void runDiagnostics()}
          onSelectCustomExporter={() => void selectExistingExporter()}
          outputEvents={processOutputEvents}
          probe={probe}
          progress={runProgress}
          release={release}
          runningDiagnostics={runningDiagnostics}
          selectingCustomExporter={selectingCustomExporter}
          updateAvailable={updateAvailable}
        />
      ) : null}

      {aboutOpen ? (
        <AboutDialog
          appName={appName}
          onClose={() => setAboutOpen(false)}
          spenlioEdition={isSpenlioEdition}
        />
      ) : null}

      <ToastStack onDismiss={dismissToast} toasts={toasts} />
    </>
  );
}

function getNextAction({
  canStartExport,
  hasConfigIssues,
  isPreviewHarness,
  needsBackupPassword,
  outputPathChosen,
  outputWritable,
  sourceChosen,
  toolUnavailable,
}: {
  canStartExport: boolean;
  hasConfigIssues: boolean;
  isPreviewHarness: boolean;
  needsBackupPassword: boolean;
  outputPathChosen: boolean;
  outputWritable: boolean;
  sourceChosen: boolean;
  toolUnavailable: boolean;
}): string | null {
  if (canStartExport) {
    return null;
  }

  if (!sourceChosen) {
    return "Next: choose your messages in step 1.";
  }

  if (needsBackupPassword) {
    return "Next: enter your backup password in step 1.";
  }

  if (hasConfigIssues) {
    return "Next: fix the highlighted options above.";
  }

  if (!outputWritable) {
    if (isPreviewHarness) {
      return "Exports run in the desktop app — this preview only shows the flow.";
    }

    return outputPathChosen
      ? "Next: that folder can't be written to — choose a different save folder."
      : "Next: choose a save folder.";
  }

  if (toolUnavailable) {
    return "The export tool isn't available for this computer yet — open Export tool for details.";
  }

  return "Next: finish the steps above.";
}

function shouldClearBackupPassword(previousOptions: ExportOptions, nextOptions: ExportOptions): boolean {
  return (
    previousOptions.platform !== nextOptions.platform ||
    previousOptions.databasePath !== nextOptions.databasePath ||
    previousOptions.encryptedBackup !== nextOptions.encryptedBackup
  );
}

function normalizeExportOptionPaths(options: ExportOptions): ExportOptions {
  return {
    ...options,
    outputPath: normalizeLocalPathForDisplay(options.outputPath),
    databasePath: normalizeOptionalLocalPathForDisplay(options.databasePath),
    attachmentRoot: normalizeOptionalLocalPathForDisplay(options.attachmentRoot),
  };
}

function getFileManagerLabel(snapshot: Pick<SystemSnapshot, "os">): string {
  const os = snapshot.os.toLowerCase();
  if (os.includes("windows")) {
    return "Show in Explorer";
  }

  if (os.includes("mac") || os.includes("darwin")) {
    return "Show in Finder";
  }

  return "Open folder";
}

function sourceLocationPathForOpen(options: ExportOptions): string {
  const sourcePath = options.databasePath?.trim() ?? "";
  if (!sourcePath || options.platform === "iOS") {
    return sourcePath;
  }

  return parentPath(sourcePath);
}

function parentPath(path: string): string {
  const lastForwardSlash = path.lastIndexOf("/");
  const lastBackSlash = path.lastIndexOf("\\");
  const lastSeparator = Math.max(lastForwardSlash, lastBackSlash);

  if (lastSeparator <= 0) {
    return path;
  }

  return path.slice(0, lastSeparator);
}

function previewOutputAccess(outputPath: string): OutputAccessCheck {
  const normalizedOutputPath = normalizeLocalPathForDisplay(outputPath);
  return {
    path: normalizedOutputPath,
    resolvedPath: normalizedOutputPath,
    writable: false,
    checkedAt: "",
    detail: "Desktop write access check has not run.",
    error: null,
  };
}

export default App;
