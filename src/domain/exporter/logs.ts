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

export function filterStoredLogs(logs: StoredLogEntry[], query: string): StoredLogEntry[] {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (terms.length === 0) {
    return logs;
  }

  return logs.filter((log) => {
    const haystack = buildStoredLogSearchText(log);
    return terms.every((term) => haystack.includes(term));
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

function buildStoredLogSearchText(log: StoredLogEntry): string {
  return normalizeSearchText(
    [
      log.kind,
      log.fileName,
      log.path,
      log.command,
      log.outputPath,
      log.success === true ? "completed success passed" : null,
      log.success === false ? "failed error warning review" : null,
      log.success === null || log.success === undefined ? "recorded unknown" : null,
      log.exitCode === null || log.exitCode === undefined ? null : `exit ${log.exitCode}`,
      describeStoredLog(log),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function formatDecimal(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}
