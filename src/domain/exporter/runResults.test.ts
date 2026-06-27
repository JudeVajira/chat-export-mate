import { describe, expect, it } from "vitest";
import { summarizeExportRunResult } from "./runResults";
import type { ExportRunResult } from "./types";

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
      message: "Export finished with exit code 0. Log saved to C:/logs/export-run-1.log.",
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
    expect(summary.message).toContain("Messages data is blocked by system permissions");
    expect(summary.message).toContain("C:/logs/export-run-1.log");
  });
});

