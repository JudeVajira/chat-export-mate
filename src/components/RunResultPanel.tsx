import { AlertTriangle, CheckCircle2, ClipboardList, FileText } from "lucide-react";
import type { RunSummary } from "../domain/exporter/runResults";

export function RunResultPanel({ summary }: { summary: RunSummary | null }) {
  const Icon = summary ? (summary.level === "error" ? AlertTriangle : CheckCircle2) : ClipboardList;

  return (
    <section className="panel result-panel" aria-labelledby="run-result-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Latest result</p>
          <h2 id="run-result-title">{summary?.title ?? "No run result yet"}</h2>
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
            {summary.logPath ? <ResultMeta label="Log path" value={summary.logPath} code /> : null}
          </div>

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
        <p className="empty-state">Completed exports and diagnostics will appear here after they run.</p>
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
