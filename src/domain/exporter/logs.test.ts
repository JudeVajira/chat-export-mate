import { describe, expect, it } from "vitest";
import { describeStoredLog, sortStoredLogs, storedLogState } from "./logs";
import type { StoredLogEntry } from "./types";

const exportLog: StoredLogEntry = {
  id: "export:2",
  kind: "export",
  fileName: "export-run-2.log",
  path: "C:/logs/export-run-2.log",
  command: "imessage-exporter -f html",
  success: true,
  exitCode: 0,
  startedAt: "2",
  completedAt: "3",
  outputPath: "~/imessage_export",
};

describe("sortStoredLogs", () => {
  it("sorts newest logs first using their start timestamp", () => {
    const older: StoredLogEntry = {
      ...exportLog,
      id: "export:1",
      fileName: "export-run-1.log",
      startedAt: "1",
    };

    expect(sortStoredLogs([older, exportLog]).map((log) => log.id)).toEqual([
      "export:2",
      "export:1",
    ]);
  });
});

describe("describeStoredLog", () => {
  it("describes a successful export log", () => {
    expect(describeStoredLog(exportLog)).toBe("Export completed with exit code 0");
  });

  it("describes a failed diagnostic log without an exit code", () => {
    expect(
      describeStoredLog({
        ...exportLog,
        kind: "diagnostic",
        success: false,
        exitCode: null,
      }),
    ).toBe("Diagnostics failed without an exit code");
  });
});

describe("storedLogState", () => {
  it("marks failed logs for review", () => {
    expect(storedLogState({ ...exportLog, success: false })).toBe("warning");
  });

  it("marks successful or unknown logs as available", () => {
    expect(storedLogState(exportLog)).toBe("passed");
    expect(storedLogState({ ...exportLog, success: null })).toBe("passed");
  });
});
