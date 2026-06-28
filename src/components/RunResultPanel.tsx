import { AlertTriangle, CheckCircle2, ClipboardList, FileText, FolderOpen } from "lucide-react";
import type { RunSummary } from "../domain/exporter/runResults";

export function RunResultPanel({
  onOpenLog,
  onOpenOutput,
  summary,
}: {
  onOpenLog?: (path: string) => void;
  onOpenOutput?: (path: string) => void;
  summary: RunSummary | null;
}) {
  const Icon = summary ? (summary.level === "error" ? AlertTriangle : CheckCircle2) : ClipboardList;
  const outputPath = summary?.outputPath;
  const logPath = summary?.logPath;
  const canOpenLog = Boolean(logPath && onOpenLog && summary?.level === "error");
  const canOpenOutput = Boolean(outputPath && onOpenOutput);

  return (
    <section className="panel result-panel" aria-labelledby="run-result-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Outcome</p>
          <h2 id="run-result-title">{summary?.title ?? "Waiting for export"}</h2>
        </div>
        <Icon
          aria-hidden="true"
          className={`heading-icon ${summary?.level === "error" ? "heading-icon--error" : ""}`}
        />
      </div>

      {summary ? (
        <div className="result-body">
          <div className="result-status">
            <span className={`result-icon result-icon--${summary.level}`}>
              <Icon aria-hidden="true" />
            </span>
            <div>
              <p>{summary.detail}</p>
              {summary.level === "info" ? (
                <span className="result-state-label">Completed</span>
              ) : (
                <span className="result-state-label result-state-label--error">Needs attention</span>
              )}
            </div>
          </div>

          {summary.error ? (
            <div className="result-section-grid">
              <ResultField label="Explanation" value={summary.error.explanation} />
              <ResultField label="Likely cause" value={summary.error.likelyCause} />
              <ResultField label="Suggested fix" value={summary.error.suggestedFix} />
            </div>
          ) : null}

          <div className="result-meta">
            {summary.exitCode !== undefined && summary.exitCode !== null ? (
              <ResultMeta label="Exit code" value={String(summary.exitCode)} />
            ) : null}
            {summary.meta?.map((item) => (
              <ResultMeta
                code={item.code}
                key={`${item.label}:${item.value}`}
                label={item.label}
                value={item.value}
              />
            ))}
            {outputPath ? <ResultMeta label="Output path" value={outputPath} code /> : null}
          </div>

          {canOpenLog || canOpenOutput ? (
            <div className="result-actions" aria-label="Latest result actions">
              {outputPath && onOpenOutput ? (
                <button
                  className="button button--secondary button--compact"
                  onClick={() => onOpenOutput(outputPath)}
                  type="button"
                >
                  <FolderOpen aria-hidden="true" />
                  Open export
                </button>
              ) : null}
              {logPath && onOpenLog ? (
                <button
                  className="button button--secondary button--compact"
                  onClick={() => onOpenLog(logPath)}
                  type="button"
                >
                  <FileText aria-hidden="true" />
                  Troubleshooting details
                </button>
              ) : null}
            </div>
          ) : null}

          {summary.rawDetails ? (
            <details className="result-raw">
              <summary>
                <FileText aria-hidden="true" />
                Raw details
              </summary>
              <pre>{summary.rawDetails}</pre>
            </details>
          ) : null}
        </div>
      ) : (
        <p className="empty-state">Your export result will appear here after it runs.</p>
      )}
    </section>
  );
}

function ResultField({ label, value }: { label: string; value: string }) {
  return (
    <div className="result-field">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function ResultMeta({ label, value, code = false }: { label: string; value: string; code?: boolean }) {
  return (
    <div className="result-meta-row">
      <span>{label}</span>
      {code ? <code>{value}</code> : <strong>{value}</strong>}
    </div>
  );
}
