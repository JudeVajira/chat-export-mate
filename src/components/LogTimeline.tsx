import { FileText } from "lucide-react";

export interface LogEntry {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
}

export function LogTimeline({ entries }: { entries: LogEntry[] }) {
  return (
    <section className="panel log-panel" aria-labelledby="log-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Logs</p>
          <h2 id="log-title">Run history</h2>
        </div>
        <FileText aria-hidden="true" className="heading-icon" />
      </div>
      <div className="log-list">
        {entries.map((entry, index) => (
          <div className={`log-row log-row--${entry.level}`} key={`${entry.time}-${entry.message}-${index}`}>
            <span>{entry.time}</span>
            <p>{entry.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

