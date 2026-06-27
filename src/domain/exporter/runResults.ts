import { translateExporterError } from "./errors";
import type { ExportRunResult } from "./types";

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

