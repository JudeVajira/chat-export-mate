import type { DiagnosticState, StoredLogEntry } from "./types";

export function sortStoredLogs(logs: StoredLogEntry[]): StoredLogEntry[] {
  return [...logs].sort((left, right) => {
    const timestampComparison = logTimestamp(right) - logTimestamp(left);
    if (timestampComparison !== 0) {
      return timestampComparison;
    }

    return right.fileName.localeCompare(left.fileName);
  });
}

export function describeStoredLog(log: StoredLogEntry): string {
  const subject = log.kind === "diagnostic" ? "Diagnostics" : "Export";
  const status = log.success === false ? "failed" : log.success === true ? "completed" : "recorded";
  const exitCode =
    log.exitCode === null || log.exitCode === undefined
      ? "without an exit code"
      : `with exit code ${log.exitCode}`;

  return `${subject} ${status} ${exitCode}`;
}

export function storedLogState(log: StoredLogEntry): DiagnosticState {
  return log.success === false ? "warning" : "passed";
}

function logTimestamp(log: StoredLogEntry): number {
  const timestamp = Number(log.startedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}
