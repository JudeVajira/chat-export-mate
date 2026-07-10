import { useMemo, useState } from "react";
import { ExternalLink, FileArchive, RefreshCw, Search, X } from "lucide-react";
import {
  describeStoredLog,
  filterStoredLogs,
  sortStoredLogs,
  storedLogState,
} from "../../domain/exporter/logs";
import type { StoredLogDetail, StoredLogEntry } from "../../domain/exporter/types";
import { StatusPill } from "../StatusPill";

export function ActivityDrawer({
  creatingSupportBundle,
  loadingLogDetail,
  loadingStoredLogs,
  onClose,
  onCreateSupportBundle,
  onOpenStoredLog,
  onPreviewStoredLog,
  onRefreshStoredLogs,
  selectedLogDetail,
  storedLogs,
}: {
  creatingSupportBundle: boolean;
  loadingLogDetail: boolean;
  loadingStoredLogs: boolean;
  onClose: () => void;
  onCreateSupportBundle: () => void;
  onOpenStoredLog: (log: StoredLogEntry) => void;
  onPreviewStoredLog: (log: StoredLogEntry) => void;
  onRefreshStoredLogs: () => void;
  selectedLogDetail: StoredLogDetail | null;
  storedLogs: StoredLogEntry[];
}) {
  const [query, setQuery] = useState("");
  const sortedLogs = useMemo(() => sortStoredLogs(storedLogs), [storedLogs]);
  const filteredLogs = useMemo(() => filterStoredLogs(sortedLogs, query), [sortedLogs, query]);

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}>
      <aside aria-labelledby="activity-drawer-title" className="drawer" role="dialog" aria-modal="true">
        <header className="drawer-header">
          <div>
            <h2 id="activity-drawer-title">Activity</h2>
            <p>Past exports and check-ups, kept on this computer.</p>
          </div>
          <button aria-label="Close activity" className="button button--ghost button--icon" onClick={onClose} type="button">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="drawer-toolbar">
          <label className="drawer-search" htmlFor="activity-search">
            <Search aria-hidden="true" />
            <input
              id="activity-search"
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search runs"
              type="search"
              value={query}
            />
          </label>
          <button
            className="button button--ghost button--compact"
            disabled={loadingStoredLogs}
            onClick={onRefreshStoredLogs}
            type="button"
          >
            <RefreshCw aria-hidden="true" className={loadingStoredLogs ? "spin" : undefined} />
            Refresh
          </button>
        </div>

        <div className="drawer-body">
          {sortedLogs.length === 0 ? (
            <p className="empty-state">
              Nothing here yet — your first export will show up in this list.
            </p>
          ) : filteredLogs.length === 0 ? (
            <p className="empty-state">No runs match this search.</p>
          ) : (
            <div className="activity-list">
              {filteredLogs.map((log) => (
                <div className="activity-row" key={log.id}>
                  <div className="activity-row-main">
                    <div className="activity-row-title">
                      <strong>{describeStoredLog(log)}</strong>
                      <StatusPill
                        label={log.kind === "diagnostic" ? "Check-up" : "Export"}
                        state={storedLogState(log)}
                      />
                    </div>
                    <span>{formatStoredLogTime(log.startedAt)}</span>
                  </div>
                  <div className="activity-row-actions">
                    <button
                      className="button button--ghost button--compact"
                      disabled={loadingLogDetail}
                      onClick={() => onPreviewStoredLog(log)}
                      type="button"
                    >
                      Details
                    </button>
                    <button
                      aria-label={`Open ${log.fileName}`}
                      className="button button--ghost button--icon"
                      onClick={() => onOpenStoredLog(log)}
                      title="Open log file"
                      type="button"
                    >
                      <ExternalLink aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedLogDetail ? (
            <div className="activity-preview">
              <div className="activity-preview-header">
                <strong>{selectedLogDetail.entry.fileName}</strong>
                <span>
                  {selectedLogDetail.truncated ? "Preview (truncated) — " : ""}
                  may include file paths and tool output
                </span>
              </div>
              <pre>{selectedLogDetail.content}</pre>
            </div>
          ) : null}
        </div>

        <footer className="drawer-footer">
          <div>
            <strong>Need help?</strong>
            <p>Bundle your logs into one local folder you can review and share.</p>
          </div>
          <button
            className="button button--secondary"
            disabled={creatingSupportBundle}
            onClick={onCreateSupportBundle}
            type="button"
          >
            <FileArchive aria-hidden="true" />
            {creatingSupportBundle ? "Creating…" : "Create support bundle"}
          </button>
        </footer>
      </aside>
    </div>
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
