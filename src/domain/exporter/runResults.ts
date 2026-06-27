import { translateExporterError } from "./errors";
import type {
  DiagnosticRunResult,
  ExportRunResult,
  FriendlyError,
  ManagedActivationResult,
  ManagedInstallResult,
} from "./types";

type RunSummaryMeta = {
  label: string;
  value: string;
  code?: boolean;
};

export type RunSummary = {
  level: "info" | "error";
  title: string;
  detail: string;
  message: string;
  outputPath?: string;
  logPath?: string;
  exitCode?: number | null;
  rawDetails?: string;
  error?: FriendlyError;
  meta?: RunSummaryMeta[];
};

export function summarizeExportRunResult(result: ExportRunResult): RunSummary {
  if (result.success) {
    return {
      level: "info",
      title: "Export finished",
      detail: `Exit code ${result.exitCode ?? 0}.`,
      message: `Export finished with exit code ${result.exitCode ?? 0}. Log saved to ${result.logPath}.`,
      outputPath: result.outputPath,
      logPath: result.logPath,
      exitCode: result.exitCode ?? 0,
    };
  }

  const translated = translateExporterError(result.stderr || result.stdout || "Exporter exited without details.");
  return {
    level: "error",
    title: translated.title,
    detail: translated.explanation,
    message: `${translated.title}: ${translated.suggestedFix} Log saved to ${result.logPath}.`,
    outputPath: result.outputPath,
    logPath: result.logPath,
    exitCode: result.exitCode,
    rawDetails: translated.rawDetails,
    error: translated,
  };
}

export function summarizeDiagnosticRunResult(result: DiagnosticRunResult): RunSummary {
  if (result.success) {
    return {
      level: "info",
      title: "Diagnostics completed",
      detail: `Exit code ${result.exitCode ?? 0}.`,
      message: `Exporter diagnostics completed with exit code ${result.exitCode ?? 0}. Log saved to ${result.logPath}.`,
      logPath: result.logPath,
      exitCode: result.exitCode ?? 0,
    };
  }

  const translated = translateExporterError(result.stderr || result.stdout || "Diagnostics exited without details.");
  return {
    level: "error",
    title: "Diagnostics failed",
    detail: translated.explanation,
    message: `Diagnostics failed. ${translated.title}: ${translated.suggestedFix} Log saved to ${result.logPath}.`,
    logPath: result.logPath,
    exitCode: result.exitCode,
    rawDetails: translated.rawDetails,
    error: translated,
  };
}

export function createDryRunSummary(argumentCount: number): RunSummary {
  return {
    level: "info",
    title: "Dry run ready",
    detail: `${argumentCount} exporter argument${argumentCount === 1 ? "" : "s"} generated. Nothing was written.`,
    message: `Dry run generated ${argumentCount} exporter argument${argumentCount === 1 ? "" : "s"}.`,
    exitCode: null,
  };
}

export function summarizeManagedInstallResult(result: ManagedInstallResult): RunSummary {
  const cacheDetail =
    result.cacheStatus === "reused"
      ? "The release asset was reused from the local cache."
      : "The release asset was downloaded and cached locally.";

  return {
    level: "info",
    title: "Exporter ready",
    detail: `imessage-exporter ${result.release.version} was installed and verified. ${cacheDetail}`,
    message: `Installed imessage-exporter ${result.release.version} from ${result.assetName}.`,
    exitCode: null,
    meta: [
      { label: "Release", value: result.release.version },
      { label: "Asset", value: result.assetName },
      {
        label: "Cache",
        value: result.cacheStatus === "reused" ? "Reused local cache" : "Downloaded and cached",
      },
      { label: "Binary path", value: result.binaryPath, code: true },
      { label: "Cache path", value: result.cachePath, code: true },
    ],
  };
}

export function summarizeManagedActivationResult(
  version: string,
  result: ManagedActivationResult,
): RunSummary {
  return {
    level: "info",
    title: "Managed exporter activated",
    detail: `imessage-exporter ${version} was verified and set as the active managed version.`,
    message: `Activated managed imessage-exporter ${version}.`,
    exitCode: null,
    meta: [
      { label: "Release", value: version },
      ...(result.probe.path ? [{ label: "Binary path", value: result.probe.path, code: true }] : []),
    ],
  };
}

export function createManagedOperationErrorSummary({
  title,
  rawDetails,
  suggestedFix,
}: {
  title: string;
  rawDetails: string;
  suggestedFix: string;
}): RunSummary {
  const error: FriendlyError = {
    title,
    explanation: "ChatExportMate could not complete this managed exporter operation.",
    likelyCause: rawDetails,
    suggestedFix,
    rawDetails,
  };

  return {
    level: "error",
    title,
    detail: error.explanation,
    message: `${title}: ${suggestedFix}`,
    exitCode: null,
    rawDetails,
    error,
  };
}

export function createRunBlockedSummary({
  title,
  explanation,
  likelyCause,
  suggestedFix,
  rawDetails,
  message,
}: {
  title: string;
  explanation: string;
  likelyCause: string;
  suggestedFix: string;
  rawDetails?: string;
  message?: string;
}): RunSummary {
  const error: FriendlyError = {
    title,
    explanation,
    likelyCause,
    suggestedFix,
    rawDetails,
  };

  return {
    level: "error",
    title,
    detail: explanation,
    message: message ?? `${title}: ${suggestedFix}`,
    exitCode: null,
    rawDetails,
    error,
  };
}
