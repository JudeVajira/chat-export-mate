import {
  CircleAlert,
  CircleCheck,
  DownloadCloud,
  FolderOpen,
  Play,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type {
  AttachmentCopyMethod,
  ExportFormat,
  ExportOptions,
  ExportPlatform,
} from "../domain/exporter/types";
import type { ExportPreflightSummary } from "../domain/exporter/preflight";
import { validationMessagesFor } from "../domain/exporter/validation";
import type { ValidationIssueMap } from "../domain/exporter/validation";

interface ExportConfiguratorProps {
  options: ExportOptions;
  onChange: (options: ExportOptions) => void;
  checkingOutputAccess: boolean;
  isRunning: boolean;
  isPreparingExporter?: boolean;
  issueMap: ValidationIssueMap;
  onCheckOutputAccess: () => void;
  onPrepareExporter?: () => void;
  onPickAttachmentRoot: () => void;
  onPickOutput: () => void;
  onPickSource: () => void;
  onOpenOutput: () => void;
  onRun: () => void;
  preflight: ExportPreflightSummary;
  showMacSourceChoice: boolean;
}

const formats: Array<{ label: string; value: ExportFormat; description: string }> = [
  { label: "Easy to read", value: "html", description: "HTML files you can open in a browser." },
  { label: "Plain text archive", value: "txt", description: "Simple transcript files for long-term storage." },
  { label: "Spreadsheet", value: "csv", description: "CSV rows for Excel, Sheets, searching, and filtering." },
];
const platforms: Array<{ label: string; value: ExportPlatform }> = [
  { label: "Mac Messages", value: "macOS" },
  { label: "iPhone backup", value: "iOS" },
];
const copyMethods: AttachmentCopyMethod[] = ["disabled", "clone", "basic", "full"];
const copyMethodLabels: Record<AttachmentCopyMethod, string> = {
  disabled: "Skip attachments",
  clone: "Fast copy",
  basic: "Basic copy",
  full: "Full copy",
};

export function ExportConfigurator({
  options,
  onChange,
  checkingOutputAccess,
  isRunning,
  isPreparingExporter = false,
  issueMap,
  onCheckOutputAccess,
  onPrepareExporter,
  onPickAttachmentRoot,
  onPickOutput,
  onPickSource,
  onOpenOutput,
  onRun,
  preflight,
  showMacSourceChoice,
}: ExportConfiguratorProps) {
  const update = <Key extends keyof ExportOptions>(key: Key, value: ExportOptions[Key]) => {
    onChange({ ...options, [key]: value });
  };
  const selectPlatform = (platform: ExportPlatform) => {
    if (platform === options.platform) {
      return;
    }

    onChange({
      ...options,
      platform,
      databasePath: "",
      attachmentRoot: platform === "iOS" ? "" : options.attachmentRoot,
    });
  };
  const isIosSource = options.platform === "iOS";
  const sourceLabel = isIosSource ? "iPhone backup folder" : "Mac Messages database";
  const sourcePlaceholder = isIosSource
    ? "Choose the local iPhone backup folder"
    : "~/Library/Messages/chat.db";
  const sourceHint = isIosSource
    ? "Use the folder button for a step-by-step guide to creating or finding a local iPhone backup."
    : "Use the folder button if you need help finding or choosing the Mac Messages database.";
  const PreflightIcon =
    preflight.state === "ready"
      ? CircleCheck
      : preflight.state === "blocked"
        ? TriangleAlert
        : CircleAlert;
  const outputIssues = validationMessagesFor(issueMap, "outputPath");
  const sourceIssues = validationMessagesFor(issueMap, "databasePath");
  const startDateIssues = validationMessagesFor(issueMap, "startDate");
  const endDateIssues = validationMessagesFor(issueMap, "endDate");
  const customNameIssues = validationMessagesFor(issueMap, "customName");
  const canPrepareExporter =
    preflight.recommendedAction?.id === "install-exporter" && Boolean(onPrepareExporter);
  const primaryActionLabel = canPrepareExporter
    ? isPreparingExporter
      ? "Setting up reader"
      : preflight.recommendedAction?.label ?? preflight.actionLabel
    : isRunning
      ? "Exporting messages"
      : preflight.actionLabel;
  const primaryActionDisabled =
    isRunning ||
    isPreparingExporter ||
    (!preflight.canRunExport && !canPrepareExporter);
  const PrimaryActionIcon = canPrepareExporter ? DownloadCloud : Play;

  return (
    <section className="panel export-panel" aria-labelledby="export-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Export</p>
          <h2 id="export-title">Choose your export</h2>
        </div>
      </div>

      <div className={`preflight-summary preflight-summary--${preflight.state}`}>
        <div className="preflight-main">
          <PreflightIcon aria-hidden="true" />
          <div>
            <h3>{preflight.title}</h3>
            <p>{preflight.detail}</p>
          </div>
        </div>
        {preflight.blockingReasons.length > 0 ? (
          <ul className="preflight-list">
            {preflight.blockingReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
        {preflight.nonBlockingNotes.length > 0 ? (
          <div className="preflight-notes">
            {preflight.nonBlockingNotes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        ) : null}
        {preflight.recommendedAction ? (
          <p className="preflight-action-detail">{preflight.recommendedAction.detail}</p>
        ) : null}
      </div>

      <div className="action-row">
        <div className="action-row-group">
          <button
            className="button button--secondary"
            disabled={checkingOutputAccess}
            onClick={onCheckOutputAccess}
            type="button"
          >
            <ShieldCheck aria-hidden="true" />
            {checkingOutputAccess ? "Checking" : "Check save folder"}
          </button>
          <button className="button button--secondary" onClick={onOpenOutput} type="button">
            <FolderOpen aria-hidden="true" />
            Open save folder
          </button>
        </div>
        <button
          className="button button--primary"
          disabled={primaryActionDisabled}
          onClick={canPrepareExporter ? onPrepareExporter : onRun}
          type="button"
        >
          <PrimaryActionIcon aria-hidden="true" />
          {primaryActionLabel}
        </button>
      </div>

      <div className="config-grid">
        <div className="output-preview span-2" aria-label="What the export creates">
          <div>
            <span>What you will get</span>
            <strong>{formatPreviewTitle(options.format)}</strong>
            <p>{formatPreviewDescription(options.format)}</p>
          </div>
          <ul>
            {formatPreviewFiles(options.format).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <fieldset>
          <legend>Format</legend>
          <div className="format-choice-list">
            {formats.map((format) => (
              <button
                className={`format-choice ${options.format === format.value ? "is-selected" : ""}`}
                key={format.value}
                onClick={() => update("format", format.value)}
                type="button"
              >
                <strong>{format.label}</strong>
                <span>{format.value.toUpperCase()}</span>
                <small>{format.description}</small>
              </button>
            ))}
          </div>
          <p className="field-hint">
            Choose the format that matches how you want to use the saved messages.
          </p>
        </fieldset>

        {showMacSourceChoice ? (
          <fieldset>
            <legend>Source</legend>
            <div className="segmented-control">
              {platforms.map((platform) => (
                <button
                  className={options.platform === platform.value ? "is-selected" : ""}
                  key={platform.value}
                  onClick={() => selectPlatform(platform.value)}
                  type="button"
                >
                  {platform.label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <div className="source-summary">
            <span>Source</span>
            <strong>iPhone backup on this computer</strong>
            <p>ChatExportMate reads a local backup folder. It does not upload your messages.</p>
          </div>
        )}

        <div className={`field span-2 ${outputIssues.length > 0 ? "field--error" : ""}`}>
          <label className="field-label" htmlFor="output-folder">
            Output folder
          </label>
          <div className="input-with-action">
            <input
              aria-describedby={outputIssues.length > 0 ? "output-folder-errors" : undefined}
              aria-invalid={outputIssues.length > 0}
              id="output-folder"
              onChange={(event) => update("outputPath", event.currentTarget.value)}
              value={options.outputPath}
            />
            <button
              className="field-action"
              onClick={onPickOutput}
              title="Choose output folder"
              type="button"
            >
              <FolderOpen aria-hidden="true" />
            </button>
          </div>
          <FieldIssues fieldId="output-folder" issues={outputIssues} />
        </div>

        <div className={`field span-2 ${sourceIssues.length > 0 ? "field--error" : ""}`}>
          <label className="field-label" htmlFor="custom-source">
            {sourceLabel}
          </label>
          <div className="input-with-action">
            <input
              aria-describedby={sourceIssues.length > 0 ? "custom-source-errors" : undefined}
              aria-invalid={sourceIssues.length > 0}
              id="custom-source"
              onChange={(event) => update("databasePath", event.currentTarget.value)}
              placeholder={sourcePlaceholder}
              value={options.databasePath}
            />
            <button
              className="field-action"
              onClick={onPickSource}
              title="Open source guide"
              type="button"
            >
              <FolderOpen aria-hidden="true" />
            </button>
          </div>
          <p className="field-hint">{sourceHint}</p>
          <FieldIssues fieldId="custom-source" issues={sourceIssues} />
        </div>

        <label className="field">
          <span>Attachments</span>
          <select
            onChange={(event) => update("copyMethod", event.currentTarget.value as AttachmentCopyMethod)}
            value={options.copyMethod}
          >
            {copyMethods.map((method) => (
              <option key={method} value={method}>
                {copyMethodLabels[method]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Contact filter</span>
          <input
            onChange={(event) => update("conversationFilter", event.currentTarget.value)}
            placeholder="name, phone, or email"
            value={options.conversationFilter}
          />
        </label>

        <div className="field span-2">
          <label className="field-label" htmlFor="attachment-root">
            Attachments folder
          </label>
          <div className="input-with-action">
            <input
              disabled={isIosSource}
              id="attachment-root"
              onChange={(event) => update("attachmentRoot", event.currentTarget.value)}
              placeholder={
                isIosSource
                  ? "Read from the selected backup"
                  : "Optional folder for Messages attachments"
              }
              value={isIosSource ? "" : options.attachmentRoot}
            />
            <button
              className="field-action"
              disabled={isIosSource}
              onClick={onPickAttachmentRoot}
              title="Choose attachments folder"
              type="button"
            >
              <FolderOpen aria-hidden="true" />
            </button>
          </div>
          <p className="field-hint">
            {isIosSource
              ? "Custom attachment roots are only used for macOS exports."
              : "Use this only when attachments are stored outside the default Messages folder."}
          </p>
        </div>

        <label className={`field ${startDateIssues.length > 0 ? "field--error" : ""}`} htmlFor="start-date">
          <span>Start date</span>
          <input
            aria-describedby={startDateIssues.length > 0 ? "start-date-errors" : undefined}
            aria-invalid={startDateIssues.length > 0}
            id="start-date"
            onChange={(event) => update("startDate", event.currentTarget.value)}
            placeholder="YYYY-MM-DD"
            value={options.startDate}
          />
          <FieldIssues fieldId="start-date" issues={startDateIssues} />
        </label>

        <label className={`field ${endDateIssues.length > 0 ? "field--error" : ""}`} htmlFor="end-date">
          <span>End date</span>
          <input
            aria-describedby={endDateIssues.length > 0 ? "end-date-errors" : undefined}
            aria-invalid={endDateIssues.length > 0}
            id="end-date"
            onChange={(event) => update("endDate", event.currentTarget.value)}
            placeholder="YYYY-MM-DD"
            value={options.endDate}
          />
          <FieldIssues fieldId="end-date" issues={endDateIssues} />
        </label>

        <details className="advanced-options span-2">
          <summary>Advanced options</summary>
          <div className="advanced-option-grid">
            <label
              className={`field ${customNameIssues.length > 0 ? "field--error" : ""}`}
              htmlFor="custom-export-name"
            >
              <span>Custom export name</span>
              <input
                aria-describedby={customNameIssues.length > 0 ? "custom-export-name-errors" : undefined}
                aria-invalid={customNameIssues.length > 0}
                id="custom-export-name"
                onChange={(event) => update("customName", event.currentTarget.value)}
                placeholder="Optional display name"
                value={options.customName}
              />
              <FieldIssues fieldId="custom-export-name" issues={customNameIssues} />
            </label>

            <div className="checkbox-stack">
              <label className="checkbox-option">
                <input
                  checked={options.useCallerId}
                  onChange={(event) => update("useCallerId", event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>Use caller ID</span>
              </label>
              <label className="checkbox-option">
                <input
                  checked={options.noLazyImages}
                  onChange={(event) => update("noLazyImages", event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>Printer-ready images</span>
              </label>
              <label className="checkbox-option">
                <input
                  checked={options.ignoreDiskWarning}
                  onChange={(event) => update("ignoreDiskWarning", event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>Bypass disk check</span>
              </label>
              <label className="checkbox-option">
                <input
                  checked={options.noProgress}
                  onChange={(event) => update("noProgress", event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>Quiet progress output</span>
              </label>
            </div>
          </div>
        </details>
      </div>

    </section>
  );
}

function formatPreviewTitle(format: ExportFormat): string {
  if (format === "csv") {
    return "Spreadsheet-friendly message rows";
  }

  if (format === "txt") {
    return "Plain transcript files";
  }

  return "Readable conversation pages";
}

function formatPreviewDescription(format: ExportFormat): string {
  if (format === "csv") {
    return "Best when you want to filter, search, or review messages in Excel or Google Sheets.";
  }

  if (format === "txt") {
    return "Best for a simple long-term archive that opens in any text editor.";
  }

  return "Best for browsing your saved conversations later in a normal web browser.";
}

function formatPreviewFiles(format: ExportFormat): string[] {
  if (format === "csv") {
    return ["ChatExportMate Export folder", "messages.csv", "attachments folder when selected"];
  }

  if (format === "txt") {
    return ["ChatExportMate Export folder", "conversation text files", "attachments folder when selected"];
  }

  return ["ChatExportMate Export folder", "readable conversation HTML files", "attachments folder when selected"];
}

function FieldIssues({ fieldId, issues }: { fieldId: string; issues: string[] }) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <ul className="field-error-list" id={`${fieldId}-errors`}>
      {issues.map((issue) => (
        <li key={issue}>{issue}</li>
      ))}
    </ul>
  );
}
