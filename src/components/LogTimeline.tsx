import { ExternalLink, FileArchive, FileText, RefreshCw, Search } from "lucide-react";
import {
  describeStoredLog,
  describeStoredLogPreview,
  sortStoredLogs,
  storedLogState,
} from "../domain/exporter/logs";
import type { StoredLogDetail, StoredLogEntry } from "../domain/exporter/types";
import { StatusPill } from "./StatusPill";

export interface LogEntry {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
}

export function LogTimeline({
  entries,
  creatingSupportBundle,
  loadingLogDetail,
  loadingStoredLogs,
  onCreateSupportBundle,
  onOpenStoredLog,
  onPreviewStoredLog,
  onRefreshStoredLogs,
  selectedLogDetail,
  storedLogs,
}: {
  entries: LogEntry[];
  creatingSupportBundle: boolean;
  loadingLogDetail: boolean;
  loadingStoredLogs: boolean;
  onCreateSupportBundle: () => void;
  onOpenStoredLog: (log: StoredLogEntry) => void;
  onPreviewStoredLog: (log: StoredLogEntry) => void;
  onRefreshStoredLogs: () => void;
  selectedLogDetail: StoredLogDetail | null;
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
                  <div className="stored-log-actions">
                    <button
                      className="button button--secondary button--icon"
                      disabled={loadingLogDetail}
                      onClick={() => onPreviewStoredLog(log)}
                      type="button"
                      title={`Preview ${log.fileName}`}
                      aria-label={`Preview ${log.fileName}`}
                    >
                      <Search aria-hidden="true" />
                    </button>
                    <button
                      className="button button--secondary button--icon"
                      onClick={() => onOpenStoredLog(log)}
                      type="button"
                      title={`Open ${log.fileName}`}
                      aria-label={`Open ${log.fileName}`}
                    >
                      <ExternalLink aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="stored-log-preview">
        <div className="history-subheading">
          <FileText aria-hidden="true" />
          <h3>Log preview</h3>
        </div>
        {loadingLogDetail ? (
          <p className="empty-state">Loading the selected local log.</p>
        ) : selectedLogDetail ? (
          <div className="stored-log-preview-body">
            <div className="stored-log-preview-meta">
              <div>
                <span>File</span>
                <strong>{selectedLogDetail.entry.fileName}</strong>
              </div>
              <div>
                <span>Summary</span>
                <strong>{describeStoredLog(selectedLogDetail.entry)}</strong>
              </div>
              <div>
                <span>Preview</span>
                <strong>{describeStoredLogPreview(selectedLogDetail)}</strong>
              </div>
            </div>
            <p className="privacy-note">
              Logs are local and may include paths, command arguments, stdout, stderr, or exporter
              details. Review the content before sharing a support bundle or log file.
            </p>
            <pre className="stored-log-raw">{selectedLogDetail.content}</pre>
          </div>
        ) : (
          <p className="empty-state">
            Select a saved export or diagnostic log to inspect its local troubleshooting details.
          </p>
        )}
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
