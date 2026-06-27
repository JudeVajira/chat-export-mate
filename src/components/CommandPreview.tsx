import { TerminalSquare } from "lucide-react";
import type { BuiltCommand, ValidationIssue } from "../domain/exporter/types";

export function CommandPreview({
  command,
  issues,
}: {
  command: BuiltCommand;
  issues: ValidationIssue[];
}) {
  return (
    <section className="panel command-panel" aria-labelledby="command-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Transparency</p>
          <h2 id="command-title">Command preview</h2>
        </div>
        <TerminalSquare aria-hidden="true" className="heading-icon" />
      </div>
      <pre>{command.displayCommand}</pre>
      {issues.length > 0 ? (
        <ul className="issue-list">
          {issues.map((issue) => (
            <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Ready to run with the selected options.</p>
      )}
    </section>
  );
}

