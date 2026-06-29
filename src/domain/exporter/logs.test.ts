import { describe, expect, it } from "vitest";
import {
  describeStoredLog,
  describeStoredLogPreview,
  filterStoredLogs,
  formatByteSize,
  sortStoredLogs,
  storedLogState,
} from "./logs";
import type { StoredLogDetail, StoredLogEntry } from "./types";

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

describe("filterStoredLogs", () => {
  const diagnosticLog: StoredLogEntry = {
    ...exportLog,
    id: "diagnostic:1",
    kind: "diagnostic",
    fileName: "diagnostic-run-1.log",
    path: "C:/logs/diagnostic-run-1.log",
    command: "imessage-exporter -d",
    success: false,
    exitCode: 1,
    outputPath: null,
  };

  it("returns every stored log when the query is empty", () => {
    expect(filterStoredLogs([exportLog, diagnosticLog], "   ")).toEqual([
      exportLog,
      diagnosticLog,
    ]);
  });

  it("matches saved logs by file name, command, and output path", () => {
    expect(
      filterStoredLogs([exportLog, diagnosticLog], "export-run").map((log) => log.id),
    ).toEqual(["export:2"]);
    expect(
      filterStoredLogs([exportLog, diagnosticLog], "-d").map((log) => log.id),
    ).toEqual(["diagnostic:1"]);
    expect(
      filterStoredLogs([exportLog, diagnosticLog], "imessage_export").map((log) => log.id),
    ).toEqual(["export:2"]);
  });

  it("matches status and exit-code terms together", () => {
    expect(
      filterStoredLogs([exportLog, diagnosticLog], "failed exit 1").map((log) => log.id),
    ).toEqual(["diagnostic:1"]);
  });

  it("requires every search term to match the same stored log", () => {
    expect(filterStoredLogs([exportLog, diagnosticLog], "diagnostic imessage_export")).toEqual([]);
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

describe("formatByteSize", () => {
  it("formats bytes and binary units for log previews", () => {
    expect(formatByteSize(512)).toBe("512 B");
    expect(formatByteSize(1536)).toBe("1.5 KiB");
    expect(formatByteSize(1024 * 32)).toBe("32 KiB");
    expect(formatByteSize(1024 * 1024 * 2.25)).toBe("2.3 MiB");
    expect(formatByteSize(-1)).toBe("unknown size");
  });
});

describe("describeStoredLogPreview", () => {
  it("explains complete and truncated local log previews", () => {
    const detail: StoredLogDetail = {
      entry: exportLog,
      content: "started_at: 2",
      size: 1536,
      truncated: false,
    };

    expect(describeStoredLogPreview(detail)).toBe("Previewing the complete 1.5 KiB local log.");
    expect(describeStoredLogPreview({ ...detail, truncated: true })).toBe(
      "Previewing the first 1.5 KiB; open the log for the complete file.",
    );
  });
});
