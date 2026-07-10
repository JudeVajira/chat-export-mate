import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Folder,
  Globe,
  Loader2,
  Paperclip,
  Play,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import type { RunProgress } from "../../domain/exporter/runProgress";
import type { RunSummary } from "../../domain/exporter/runResults";
import type { ExportOptions, ProcessOutputEvent } from "../../domain/exporter/types";
import { ProgressSteps } from "../ProgressSteps";
import { pathBasename } from "./flowFormat";

export type ExportStage = "configure" | "running" | "success" | "failed";

interface PreviewFile {
  icon: typeof FileText;
  name: string;
  note: string;
}

export function ArchivePreviewCard({
  blockers,
  canStart,
  onOpenLog,
  onOpenOutput,
  onReset,
  onStart,
  options,
  outputEvents,
  progress,
  stage,
  startLabel,
  summary,
}: {
  blockers: string[];
  canStart: boolean;
  onOpenLog: (path: string) => void;
  onOpenOutput: (path: string) => void;
  onReset: () => void;
  onStart: () => void;
  options: ExportOptions;
  outputEvents: ProcessOutputEvent[];
  progress: RunProgress | null;
  stage: ExportStage;
  startLabel: string;
  summary: RunSummary | null;
}) {
  return (
    <aside aria-label="Your archive" className={`archive-card archive-card--${stage}`}>
      <div aria-hidden="true" className="archive-card-edge" />

      {stage === "configure" ? (
        <>
          <div className="archive-card-heading">
            <p>You will get</p>
            <h2>{previewTitle(options)}</h2>
          </div>

          <div className="archive-listing" aria-label="Files this export creates">
            <div className="archive-listing-folder">
              <Folder aria-hidden="true" />
              <span>{pathBasename(options.outputPath) || "Export folder"}</span>
            </div>
            {previewFiles(options).map((file) => {
              const Icon = file.icon;
              return (
                <div className="archive-listing-file" key={file.name}>
                  <Icon aria-hidden="true" />
                  <div>
                    <code>{file.name}</code>
                    <small>{file.note}</small>
                  </div>
                </div>
              );
            })}
          </div>

          {blockers.length > 0 ? (
            <ul className="archive-blockers" aria-label="Before you can export">
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          ) : null}

          <button
            className="button button--primary button--large archive-start"
            disabled={!canStart}
            onClick={onStart}
            type="button"
          >
            <Play aria-hidden="true" />
            {startLabel}
          </button>
          <p className="archive-reassurance">
            Everything runs on this computer. Your messages are never uploaded.
          </p>
        </>
      ) : null}

      {stage === "running" && progress ? (
        <>
          <div className="archive-card-heading">
            <p className="archive-running-kicker">
              <Loader2 aria-hidden="true" className="spin" />
              Working
            </p>
            <h2>{progress.title}</h2>
          </div>
          <ProgressSteps outputEvents={outputEvents} progress={progress} />
        </>
      ) : null}

      {stage === "success" && summary ? (
        <div className="archive-result archive-result--success">
          <CheckCircle2 aria-hidden="true" className="archive-result-icon" />
          <h2>{summary.title}</h2>
          <p>{summary.detail}</p>
          <div className="archive-result-actions">
            {summary.outputPath ? (
              <button
                className="button button--primary"
                onClick={() => onOpenOutput(summary.outputPath as string)}
                type="button"
              >
                <FolderOpen aria-hidden="true" />
                Open folder
              </button>
            ) : null}
            <button className="button button--ghost" onClick={onReset} type="button">
              <RotateCcw aria-hidden="true" />
              Export again
            </button>
          </div>
        </div>
      ) : null}

      {stage === "failed" && summary ? (
        <div className="archive-result archive-result--failed">
          <TriangleAlert aria-hidden="true" className="archive-result-icon" />
          <h2>{summary.title}</h2>
          {summary.error ? (
            <dl className="archive-error-fields">
              <div>
                <dt>What happened</dt>
                <dd>{summary.error.explanation}</dd>
              </div>
              <div>
                <dt>Likely cause</dt>
                <dd>{summary.error.likelyCause}</dd>
              </div>
              <div>
                <dt>How to fix it</dt>
                <dd>{summary.error.suggestedFix}</dd>
              </div>
            </dl>
          ) : (
            <p>{summary.detail}</p>
          )}
          <div className="archive-result-actions">
            <button className="button button--primary" onClick={onReset} type="button">
              <RotateCcw aria-hidden="true" />
              Back to setup
            </button>
            {summary.logPath ? (
              <button
                className="button button--ghost"
                onClick={() => onOpenLog(summary.logPath as string)}
                type="button"
              >
                <FileText aria-hidden="true" />
                View details
              </button>
            ) : null}
          </div>
          {summary.rawDetails ? (
            <details className="archive-raw-details">
              <summary>Technical details</summary>
              <pre>{summary.rawDetails}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function previewTitle(options: ExportOptions): string {
  if (options.format === "csv" && options.csvLayout === "spenlioCombined") {
    return "One finance spreadsheet";
  }

  if (options.format === "csv" && options.csvLayout === "spenlioBySender") {
    return "A spreadsheet per sender";
  }

  if (options.format === "csv") {
    return "One message spreadsheet";
  }

  if (options.format === "txt") {
    return "Text transcripts";
  }

  return "Browsable conversations";
}

function previewFiles(options: ExportOptions): PreviewFile[] {
  if (options.format === "csv" && options.csvLayout === "spenlioCombined") {
    return [
      {
        icon: FileSpreadsheet,
        name: "spenlio-sms-export.csv",
        note: "Business SMS senders · sender, date, ID, message",
      },
    ];
  }

  if (options.format === "csv" && options.csvLayout === "spenlioBySender") {
    return [
      {
        icon: FileSpreadsheet,
        name: "spenlio-sms-export-by-sender/",
        note: "One CSV file for each business sender",
      },
    ];
  }

  if (options.format === "csv") {
    return [
      {
        icon: FileSpreadsheet,
        name: "chatexportmate-transcript-lines.csv",
        note: "One row per transcript line",
      },
    ];
  }

  if (options.format === "txt") {
    return [
      {
        icon: FileText,
        name: "conversation transcripts (.txt)",
        note: "One file per conversation",
      },
      ...attachmentsPreview(options),
    ];
  }

  return [
    {
      icon: Globe,
      name: "conversation pages (.html)",
      note: "One page per conversation, opens in your browser",
    },
    ...attachmentsPreview(options),
  ];
}

function attachmentsPreview(options: ExportOptions): PreviewFile[] {
  if (options.copyMethod === "disabled") {
    return [];
  }

  return [
    {
      icon: Paperclip,
      name: "attachments/",
      note: "Photos and files from your conversations",
    },
  ];
}
