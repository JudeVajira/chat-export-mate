import { describe, expect, it } from "vitest";
import {
  createManagedOperationErrorSummary,
  createDryRunSummary,
  createRunBlockedSummary,
  summarizeManagedActivationResult,
  summarizeManagedInstallResult,
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
      outputPath: "~/imessage_export",
      logPath: "C:/logs/export-run-1.log",
      exitCode: 0,
    });
  });

  it("summarizes app-created CSV exports", () => {
    expect(
      summarizeExportRunResult({
        ...baseResult,
        csvPath: "C:/exports/chatexportmate-export.csv",
      }),
    ).toMatchObject({
      level: "info",
      message: "Export finished and CSV was created at C:/exports/chatexportmate-export.csv.",
      meta: [
        {
          label: "CSV file",
          value: "C:/exports/chatexportmate-export.csv",
          code: true,
        },
      ],
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
    expect(summary.outputPath).toBe("~/imessage_export");
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
  it("creates a command-check result without a saved log path", () => {
    expect(createDryRunSummary(3)).toEqual({
      level: "info",
      title: "Command check ready",
      detail: "3 exporter arguments generated. Nothing was written.",
      message: "Command check generated 3 exporter arguments.",
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

describe("managed exporter operation summaries", () => {
  it("summarizes a managed install that reused the local cache", () => {
    const summary = summarizeManagedInstallResult({
      release: {
        version: "4.2.0",
        releaseUrl: "https://github.com/ReagentX/imessage-exporter/releases/tag/v4.2.0",
        assets: [],
      },
      assetName: "imessage-exporter-x86_64-pc-windows-gnu.exe",
      binaryPath: "C:/AppData/exporter/versions/4.2.0/imessage-exporter.exe",
      cachePath: "C:/AppData/exporter/cache/4.2.0/imessage-exporter.exe",
      cacheStatus: "reused",
      probe: {
        found: true,
        managed: true,
        path: "C:/AppData/exporter/versions/4.2.0/imessage-exporter.exe",
        version: "4.2.0",
        source: "managed",
      },
      state: {
        installRoot: "C:/AppData/exporter",
        activeVersion: "4.2.0",
        installedVersions: ["4.2.0"],
      },
    });

    expect(summary).toMatchObject({
      level: "info",
      title: "Exporter ready",
      detail:
        "imessage-exporter 4.2.0 was installed and verified. The release asset was reused from the local cache.",
      message:
        "Installed imessage-exporter 4.2.0 from imessage-exporter-x86_64-pc-windows-gnu.exe.",
      meta: expect.arrayContaining([
        { label: "Cache", value: "Reused local cache" },
        {
          label: "Binary path",
          value: "C:/AppData/exporter/versions/4.2.0/imessage-exporter.exe",
          code: true,
        },
      ]),
    });
  });

  it("summarizes a managed install that downloaded a release asset", () => {
    const summary = summarizeManagedInstallResult({
      release: {
        version: "4.2.0",
        releaseUrl: "https://github.com/ReagentX/imessage-exporter/releases/tag/v4.2.0",
        assets: [],
      },
      assetName: "imessage-exporter-x86_64-pc-windows-gnu.exe",
      binaryPath: "C:/AppData/exporter/versions/4.2.0/imessage-exporter.exe",
      cachePath: "C:/AppData/exporter/cache/4.2.0/imessage-exporter.exe",
      cacheStatus: "downloaded",
      probe: { found: true, managed: true, version: "4.2.0", source: "managed" },
      state: {
        installRoot: "C:/AppData/exporter",
        activeVersion: "4.2.0",
        installedVersions: ["4.2.0"],
      },
    });

    expect(summary.detail).toContain("downloaded and cached locally");
    expect(summary.meta).toContainEqual({ label: "Cache", value: "Downloaded and cached" });
  });

  it("summarizes managed rollback activation", () => {
    expect(
      summarizeManagedActivationResult("4.1.0", {
        probe: {
          found: true,
          managed: true,
          path: "C:/AppData/exporter/versions/4.1.0/imessage-exporter.exe",
          version: "4.1.0",
          source: "managed",
        },
        state: {
          installRoot: "C:/AppData/exporter",
          activeVersion: "4.1.0",
          installedVersions: ["4.2.0", "4.1.0"],
        },
      }),
    ).toMatchObject({
      level: "info",
      title: "Managed exporter activated",
      detail: "imessage-exporter 4.1.0 was verified and set as the active managed version.",
      message: "Activated managed imessage-exporter 4.1.0.",
    });
  });

  it("creates structured managed operation errors", () => {
    const summary = createManagedOperationErrorSummary({
      title: "Exporter install failed",
      rawDetails: "Release asset was not found.",
      suggestedFix: "Check the latest release, then try the managed install again.",
    });

    expect(summary).toMatchObject({
      level: "error",
      title: "Exporter install failed",
      detail: "ChatExportMate could not complete this managed exporter operation.",
      rawDetails: "Release asset was not found.",
      error: {
        likelyCause: "Release asset was not found.",
        suggestedFix: "Check the latest release, then try the managed install again.",
      },
    });
  });
});
