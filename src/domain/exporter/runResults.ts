import { translateExporterError } from "./errors";
import type { DiagnosticRunResult, ExportRunResult, FriendlyError } from "./types";

export type RunSummary = {
  level: "info" | "error";
  title: string;
  detail: string;
  message: string;
  logPath?: string;
  exitCode?: number | null;
  rawDetails?: string;
  error?: FriendlyError;
};

export function summarizeExportRunResult(result: ExportRunResult): RunSummary {
  if (result.success) {
    return {
      level: "info",
      title: "Export finished",
      detail: `Exit code ${result.exitCode ?? 0}.`,
      message: `Export finished with exit code ${result.exitCode ?? 0}. Log saved to ${result.logPath}.`,
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
