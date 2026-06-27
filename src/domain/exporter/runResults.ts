import { translateExporterError } from "./errors";
import type { DiagnosticRunResult, ExportRunResult } from "./types";

export type RunSummary = {
  level: "info" | "error";
  message: string;
};

export function summarizeExportRunResult(result: ExportRunResult): RunSummary {
  if (result.success) {
    return {
      level: "info",
      message: `Export finished with exit code ${result.exitCode ?? 0}. Log saved to ${result.logPath}.`,
    };
  }

  const translated = translateExporterError(result.stderr || result.stdout || "Exporter exited without details.");
  return {
    level: "error",
    message: `${translated.title}: ${translated.suggestedFix} Log saved to ${result.logPath}.`,
  };
}

export function summarizeDiagnosticRunResult(result: DiagnosticRunResult): RunSummary {
  if (result.success) {
    return {
      level: "info",
      message: `Exporter diagnostics completed with exit code ${result.exitCode ?? 0}. Log saved to ${result.logPath}.`,
    };
  }

  const translated = translateExporterError(result.stderr || result.stdout || "Diagnostics exited without details.");
  return {
    level: "error",
    message: `Diagnostics failed. ${translated.title}: ${translated.suggestedFix} Log saved to ${result.logPath}.`,
  };
}
