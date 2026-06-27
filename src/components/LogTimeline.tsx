import { ExternalLink, FileArchive, FileText, RefreshCw } from "lucide-react";
import {
  describeStoredLog,
  sortStoredLogs,
  storedLogState,
} from "../domain/exporter/logs";
import type { StoredLogEntry } from "../domain/exporter/types";
import { StatusPill } from "./StatusPill";

export interface LogEntry {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
}

export function LogTimeline({
  entries,
  creatingSupportBundle,
  loadingStoredLogs,
  onCreateSupportBundle,
  onOpenStoredLog,
  onRefreshStoredLogs,
  storedLogs,
}: {
  entries: LogEntry[];
  creatingSupportBundle: boolean;
  loadingStoredLogs: boolean;
  onCreateSupportBundle: () => void;
  onOpenStoredLog: (log: StoredLogEntry) => void;
  onRefreshStoredLogs: () => void;
  storedLogs: StoredLogEntry[];
}) {
  const sortedLogs = sortStoredLogs(storedLogs);

  return (
    <section className="panel log-panel" aria-labelledby="log-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Logs</p>
          <h2 id="log-title">Run history</h2>
        </div>
        <div className="section-actions">
          <button
            className="button button--secondary button--compact"
            disabled={creatingSupportBundle}
            onClick={onCreateSupportBundle}
            type="button"
          >
            <FileArchive aria-hidden="true" />
            {creatingSupportBundle ? "Exporting" : "Export bundle"}
          </button>
          <button
            className="button button--secondary button--compact"
            disabled={loadingStoredLogs}
            onClick={onRefreshStoredLogs}
            type="button"
          >
            <RefreshCw aria-hidden="true" />
            {loadingStoredLogs ? "Loading" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="history-layout">
        <div className="history-column">
          <div className="history-subheading">
            <FileText aria-hidden="true" />
            <h3>Session activity</h3>
          </div>
          <div className="log-list">
            {entries.map((entry, index) => (
              <div className={`log-row log-row--${entry.level}`} key={`${entry.time}-${entry.message}-${index}`}>
                <span>{entry.time}</span>
                <p>{entry.message}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="history-column history-column--stored">
          <div className="history-subheading">
            <FileText aria-hidden="true" />
            <h3>Saved local logs</h3>
          </div>
          {sortedLogs.length === 0 ? (
            <p className="empty-state">
              Desktop export and diagnostic logs will appear here after a run.
            </p>
          ) : (
            <div className="stored-log-list">
              {sortedLogs.map((log) => (
                <div className="stored-log-row" key={log.id}>
                  <div className="stored-log-main">
                    <div className="stored-log-title">
                      <strong>{describeStoredLog(log)}</strong>
                      <StatusPill label={formatStoredLogKind(log)} state={storedLogState(log)} />
                    </div>
                    <p>{log.outputPath ?? log.command ?? log.fileName}</p>
                    <span>{formatStoredLogTime(log.startedAt)}</span>
                  </div>
                  <button
                    className="button button--secondary button--icon"
                    onClick={() => onOpenStoredLog(log)}
                    type="button"
                    title={`Open ${log.fileName}`}
                  >
                    <ExternalLink aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function formatStoredLogTime(value?: string | null): string {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatStoredLogKind(log: StoredLogEntry): string {
  return log.kind === "diagnostic" ? "Diagnostic" : "Export";
}
