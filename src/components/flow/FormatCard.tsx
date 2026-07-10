import { CheckCircle2, FileSpreadsheet, FileText, Globe } from "lucide-react";
import type { ExportFormat } from "../../domain/exporter/types";

const formats: Array<{
  value: ExportFormat;
  icon: typeof Globe;
  label: string;
  detail: string;
}> = [
  {
    value: "html",
    icon: Globe,
    label: "Web pages",
    detail: "Browse conversations in your browser, with photos.",
  },
  {
    value: "txt",
    icon: FileText,
    label: "Plain text",
    detail: "Simple transcripts for long-term archiving.",
  },
  {
    value: "csv",
    icon: FileSpreadsheet,
    label: "Spreadsheet",
    detail: "Every message as a row you can search and filter.",
  },
];

export function FormatCard({
  format,
  onFormatChange,
}: {
  format: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
}) {
  return (
    <section aria-labelledby="format-card-title" className="decision-card is-done">
      <header className="decision-card-header">
        <span aria-hidden="true" className="decision-card-step">
          <CheckCircle2 />
        </span>
        <div>
          <h2 id="format-card-title">Format</h2>
          <p>How do you want to read them later?</p>
        </div>
      </header>
      <div className="decision-card-body">
        <div aria-label="Export format" className="format-tiles" role="radiogroup">
          {formats.map((item) => {
            const Icon = item.icon;
            const selected = item.value === format;
            return (
              <button
                aria-checked={selected}
                className={`format-tile ${selected ? "is-selected" : ""}`}
                key={item.value}
                onClick={() => onFormatChange(item.value)}
                role="radio"
                type="button"
              >
                <Icon aria-hidden="true" />
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
