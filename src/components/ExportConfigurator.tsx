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
}

const formats: Array<{ label: string; value: ExportFormat; description: string }> = [
  { label: "HTML", value: "html", description: "Readable conversation pages" },
  { label: "Text", value: "txt", description: "Plain text transcripts" },
  { label: "CSV", value: "csv", description: "Spreadsheet-friendly rows converted from text transcripts" },
];
const platforms: Array<{ label: string; value: ExportPlatform }> = [
  { label: "Mac Messages", value: "macOS" },
  { label: "iPhone backup", value: "iOS" },
];
const copyMethods: AttachmentCopyMethod[] = ["disabled", "clone", "basic", "full"];

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
  const sourceLabel = "Message source";
  const sourcePlaceholder = isIosSource
    ? "Choose the local iPhone backup folder"
    : "~/Library/Messages/chat.db";
  const sourceHint = isIosSource
    ? "If you only have an iPhone, use the folder button for step-by-step backup instructions."
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
      ? "Setting up exporter"
      : preflight.recommendedAction?.label ?? preflight.actionLabel
    : isRunning
      ? "Running export"
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
          <h2 id="export-title">Choose export</h2>
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
            {checkingOutputAccess ? "Checking" : "Check access"}
          </button>
          <button className="button button--secondary" onClick={onOpenOutput} type="button">
            <FolderOpen aria-hidden="true" />
            Open folder
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
        <fieldset>
          <legend>Format</legend>
          <div className="segmented-control">
            {formats.map((format) => (
              <button
                className={options.format === format.value ? "is-selected" : ""}
                key={format.value}
                onClick={() => update("format", format.value)}
                title={format.description}
                type="button"
              >
                {format.label}
              </button>
            ))}
          </div>
          <p className="field-hint">
            CSV is created locally after a text export, so it is best for spreadsheet review.
          </p>
        </fieldset>

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
                {method}
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
