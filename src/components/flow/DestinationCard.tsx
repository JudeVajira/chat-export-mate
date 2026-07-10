import { CheckCircle2, CircleAlert, FolderOpen, Pencil } from "lucide-react";
import { FieldIssues } from "./FieldIssues";
import { compactPath } from "./flowFormat";

export function DestinationCard({
  checking,
  detail,
  fileManagerLabel,
  issues,
  onOpen,
  onPick,
  outputPath,
  showAccessStatus,
  step,
  writable,
}: {
  checking: boolean;
  detail: string;
  fileManagerLabel: string;
  issues: string[];
  onOpen: () => void;
  onPick: () => void;
  outputPath: string;
  showAccessStatus: boolean;
  step: number;
  writable: boolean;
}) {
  const hasPath = outputPath.length > 0;

  return (
    <section
      aria-labelledby="destination-card-title"
      className={`decision-card ${writable ? "is-done" : "is-open"} ${issues.length > 0 ? "has-issues" : ""}`}
    >
      <header className="decision-card-header">
        <span aria-hidden="true" className="decision-card-step">
          {writable ? <CheckCircle2 /> : step}
        </span>
        <div>
          <h2 id="destination-card-title">Save to</h2>
          <p>{writable ? "Your files will be saved in this folder." : "Where should the files go?"}</p>
        </div>
        {hasPath ? (
          <div className="decision-card-header-actions">
            <button className="button button--ghost button--compact" onClick={onPick} type="button">
              <Pencil aria-hidden="true" />
              Change
            </button>
          </div>
        ) : null}
      </header>

      <div className="decision-card-body">
        {hasPath ? (
          <>
            <button
              className="path-chip"
              onClick={onOpen}
              title={`${fileManagerLabel}: ${outputPath}`}
              type="button"
            >
              <FolderOpen aria-hidden="true" />
              <code>{compactPath(outputPath)}</code>
            </button>
            <p className="field-hint">A folder on this computer — click the path to open it.</p>
          </>
        ) : (
          <button className="button button--primary" onClick={onPick} type="button">
            <FolderOpen aria-hidden="true" />
            Choose a folder
          </button>
        )}
        {showAccessStatus && hasPath && !writable ? (
          <p className="destination-status">
            <CircleAlert aria-hidden="true" />
            {checking ? "Checking this folder…" : detail}
          </p>
        ) : null}
        <FieldIssues fieldId="destination" issues={issues} />
      </div>
    </section>
  );
}
