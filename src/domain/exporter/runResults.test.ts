import { describe, expect, it } from "vitest";
import {
  createDryRunSummary,
  createRunBlockedSummary,
  summarizeDiagnosticRunResult,
  summarizeExportRunResult,
} from "./runResults";
import type { DiagnosticRunResult, ExportRunResult } from "./types";

const baseResult: ExportRunResult = {
  command: "imessage-exporter -f html",
  stdout: "",
  stderr: "",
  exitCode: 0,
  success: true,
  startedAt: "1",
  completedAt: "2",
  logPath: "C:/logs/export-run-1.log",
  outputPath: "~/imessage_export",
};

describe("summarizeExportRunResult", () => {
  it("returns a success log message with the saved log path", () => {
    expect(summarizeExportRunResult(baseResult)).toEqual({
      level: "info",
      title: "Export finished",
      detail: "Exit code 0.",
      message: "Export finished with exit code 0. Log saved to C:/logs/export-run-1.log.",
      logPath: "C:/logs/export-run-1.log",
      exitCode: 0,
    });
  });

  it("translates exporter stderr for failed runs", () => {
    const summary = summarizeExportRunResult({
      ...baseResult,
      success: false,
      exitCode: 1,
      stderr: "Operation not permitted while opening ~/Library/Messages/chat.db",
    });

    expect(summary.level).toBe("error");
    expect(summary.title).toBe("Messages data is blocked by system permissions");
    expect(summary.detail).toBe("macOS is preventing the exporter from reading protected Messages files.");
    expect(summary.message).toContain("Messages data is blocked by system permissions");
    expect(summary.message).toContain("C:/logs/export-run-1.log");
    expect(summary.logPath).toBe("C:/logs/export-run-1.log");
    expect(summary.exitCode).toBe(1);
    expect(summary.error).toMatchObject({
      likelyCause: "The terminal, ChatExportMate, or the exporter binary does not have Full Disk Access.",
      suggestedFix: "Grant Full Disk Access to ChatExportMate and the exporter, then run diagnostics again.",
    });
    expect(summary.rawDetails).toBe("Operation not permitted while opening ~/Library/Messages/chat.db");
  });
});

describe("summarizeDiagnosticRunResult", () => {
  const diagnosticResult: DiagnosticRunResult = {
    command: "imessage-exporter -d",
    stdout: "Diagnostics look good",
    stderr: "",
    exitCode: 0,
    success: true,
    startedAt: "1",
    completedAt: "2",
    logPath: "C:/logs/diagnostic-run-1.log",
  };

  it("returns a success summary for upstream diagnostics", () => {
    expect(summarizeDiagnosticRunResult(diagnosticResult)).toEqual({
      level: "info",
      title: "Diagnostics completed",
      detail: "Exit code 0.",
      message:
        "Exporter diagnostics completed with exit code 0. Log saved to C:/logs/diagnostic-run-1.log.",
      logPath: "C:/logs/diagnostic-run-1.log",
      exitCode: 0,
    });
  });

  it("translates diagnostic failures", () => {
    const summary = summarizeDiagnosticRunResult({
      ...diagnosticResult,
      success: false,
      exitCode: 1,
      stderr: "chat.db not found",
    });

    expect(summary.level).toBe("error");
    expect(summary.title).toBe("Diagnostics failed");
    expect(summary.detail).toBe("The exporter could not locate the database or backup path used for this export.");
    expect(summary.message).toContain("The selected Messages source could not be found");
    expect(summary.error?.title).toBe("The selected Messages source could not be found");
  });
});

describe("local run summaries", () => {
  it("creates a dry-run result without a saved log path", () => {
    expect(createDryRunSummary(3)).toEqual({
      level: "info",
      title: "Dry run ready",
      detail: "3 exporter arguments generated. Nothing was written.",
      message: "Dry run generated 3 exporter arguments.",
      exitCode: null,
    });
  });

  it("creates a structured blocked-run error", () => {
    const summary = createRunBlockedSummary({
      title: "Output folder is not writable",
      explanation: "ChatExportMate could not verify write access before starting the exporter.",
      likelyCause: "Access denied.",
      suggestedFix: "Choose a writable output folder.",
      rawDetails: "Access denied.",
      message: "Output access check failed. Access denied.",
    });

    expect(summary).toMatchObject({
      level: "error",
      title: "Output folder is not writable",
      detail: "ChatExportMate could not verify write access before starting the exporter.",
      message: "Output access check failed. Access denied.",
      rawDetails: "Access denied.",
      error: {
        likelyCause: "Access denied.",
        suggestedFix: "Choose a writable output folder.",
      },
    });
  });
});
