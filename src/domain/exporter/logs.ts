import type { DiagnosticState, StoredLogDetail, StoredLogEntry } from "./types";

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

export function describeStoredLogPreview(detail: StoredLogDetail): string {
  const size = formatByteSize(detail.size);
  return detail.truncated
    ? `Previewing the first ${size}; open the log for the complete file.`
    : `Previewing the complete ${size} local log.`;
}

export function formatByteSize(size: number): string {
  if (!Number.isFinite(size) || size < 0) {
    return "unknown size";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  const kib = size / 1024;
  if (kib < 1024) {
    return `${formatDecimal(kib)} KiB`;
  }

  return `${formatDecimal(kib / 1024)} MiB`;
}

function logTimestamp(log: StoredLogEntry): number {
  const timestamp = Number(log.startedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatDecimal(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}
