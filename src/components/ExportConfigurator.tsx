import {
  CircleAlert,
  CircleCheck,
  DownloadCloud,
  FolderOpen,
  Loader2,
  Play,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type {
  AttachmentCopyMethod,
  CsvExportLayout,
  ExportFormat,
  ExportOptions,
  ExportPlatform,
} from "../domain/exporter/types";
import type { ExportPreflightSummary } from "../domain/exporter/preflight";
import { validationMessagesFor } from "../domain/exporter/validation";
import type { ValidationIssueMap } from "../domain/exporter/validation";

interface ExportConfiguratorProps {
  options: ExportOptions;
  backupPassword: string;
  onChange: (options: ExportOptions) => void;
  onBackupPasswordChange: (password: string) => void;
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
  onOpenSource: () => void;
  onRun: () => void;
  preflight: ExportPreflightSummary;
  appName?: string;
  spenlioEdition?: boolean;
  showMacSourceChoice: boolean;
}

const formats: Array<{ label: string; value: ExportFormat; description: string }> = [
  { label: "Easy to read", value: "html", description: "HTML files you can open in a browser." },
  { label: "Plain text archive", value: "txt", description: "Simple transcript files for long-term storage." },
  { label: "Spreadsheet", value: "csv", description: "CSV rows for Excel, Sheets, searching, and filtering." },
];
const csvLayouts: Array<{ label: string; value: CsvExportLayout; description: string }> = [
  {
    label: "One finance CSV",
    value: "spenlioCombined",
    description: "Single Spenlio-ready CSV with Apple message IDs when available.",
  },
  {
    label: "One CSV per sender",
    value: "spenlioBySender",
    description: "Separate Spenlio-ready CSV files for each named business sender.",
  },
  {
    label: "Transcript lines",
    value: "transcriptLines",
    description: "Legacy row-per-line CSV for general transcript review.",
  },
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
  backupPassword,
  onChange,
  onBackupPasswordChange,
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
  onOpenSource,
  onRun,
  preflight,
  appName = "ChatExportMate",
  spenlioEdition = false,
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
      encryptedBackup: platform === "iOS" ? options.encryptedBackup : false,
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
  const backupPasswordIssues = validationMessagesFor(issueMap, "backupPassword");
  const startDateIssues = validationMessagesFor(issueMap, "startDate");
  const endDateIssues = validationMessagesFor(issueMap, "endDate");
  const startDateBoundary = validDateInputBoundary(options.startDate);
  const endDateBoundary = validDateInputBoundary(options.endDate);
  const customNameIssues = validationMessagesFor(issueMap, "customName");
  const csvLayoutHint =
    options.csvLayout === "transcriptLines"
      ? "Transcript lines creates one row per generated transcript line for general review."
      : "Finance CSV layouts skip phone-number conversations, email senders, non-SMS messages, and your own sent messages.";
  const availableCsvLayouts = spenlioEdition
    ? csvLayouts.filter((layout) => layout.value !== "transcriptLines")
    : csvLayouts;
  const canPrepareExporter =
    preflight.recommendedAction?.id === "install-exporter" && Boolean(onPrepareExporter);
  const primaryActionLabel = canPrepareExporter
    ? isPreparingExporter
      ? "Setting up tool"
      : preflight.recommendedAction?.label ?? preflight.actionLabel
    : isRunning
      ? "Exporting messages"
      : preflight.actionLabel;
  const primaryActionDisabled =
    isRunning ||
    isPreparingExporter ||
    (!preflight.canRunExport && !canPrepareExporter);
  const isLoading = canPrepareExporter ? isPreparingExporter : isRunning;
  const PrimaryActionIcon = isLoading ? Loader2 : canPrepareExporter ? DownloadCloud : Play;
  const outputValue = options.outputPath.trim();
  const sourceValue = (options.databasePath ?? "").trim();

  return (
    <section className="panel export-panel" aria-labelledby="export-title">
      <div className="section-heading export-heading">
        <div>
          <p className="section-kicker">Export</p>
          <h2 id="export-title">{spenlioEdition ? "Create Spenlio CSV" : "Choose your export"}</h2>
          <p>
            {spenlioEdition
              ? "Check the local backup and save folder, then create the finance CSV."
              : "Check the source, save folder, and export format before starting."}
          </p>
        </div>
      </div>

      <div className="export-workspace">
        <div className="export-form-column">
          <div className="location-review-list" aria-label="Selected folders">
            <LocationReviewRow
              chooseLabel={sourceValue ? "Change" : "Start guide"}
              emptyValue={sourcePlaceholder}
              fieldId="custom-source"
              hint={sourceHint}
              issues={sourceIssues}
              label={sourceLabel}
              onChoose={onPickSource}
              onOpen={onOpenSource}
              openLabel="Open"
              value={sourceValue}
            />

            <LocationReviewRow
              chooseLabel={outputValue ? "Change" : "Choose folder"}
              emptyValue="Choose where the CSV should be saved"
              fieldId="output-folder"
              hint="This folder stays on your computer. The CSV is saved here after export."
              issues={outputIssues}
              label="Save folder"
              onChoose={onPickOutput}
              onOpen={onOpenOutput}
              openLabel="Open"
              value={outputValue}
            />
          </div>

          {isIosSource ? (
            <div
              className={`encrypted-backup-option ${
                options.encryptedBackup ? "is-selected" : ""
              } ${backupPasswordIssues.length > 0 ? "field--error" : ""}`}
            >
              <label className="checkbox-option encrypted-backup-toggle">
                <input
                  checked={options.encryptedBackup}
                  onChange={(event) => update("encryptedBackup", event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>
                  <strong>My backup is encrypted</strong>
                  <small>
                    Encrypted backups need the backup password. The password is used only for this
                    export and is not saved.
                  </small>
                </span>
              </label>
              {options.encryptedBackup ? (
                <div className="field backup-password-field">
                  <label className="field-label" htmlFor="backup-password">
                    Backup password
                  </label>
                  <input
                    aria-describedby={
                      backupPasswordIssues.length > 0 ? "backup-password-errors" : "backup-password-hint"
                    }
                    aria-invalid={backupPasswordIssues.length > 0}
                    autoComplete="off"
                    id="backup-password"
                    onChange={(event) => onBackupPasswordChange(event.currentTarget.value)}
                    type="password"
                    value={backupPassword}
                  />
                  <FieldIssues fieldId="backup-password" issues={backupPasswordIssues} />
                  <p className="field-hint" id="backup-password-hint">
                    {spenlioEdition
                      ? `${appName} uses this once to unlock the backup locally. The password is not saved.`
                      : `${appName} sends this once to the export tool through a private input pipe.`}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {showMacSourceChoice ? (
            <fieldset>
              <legend>Message source type</legend>
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
              <p>{appName} reads a local backup folder. It does not upload your messages.</p>
            </div>
          )}

          {spenlioEdition ? (
            <div className="source-summary source-summary--csv">
              <span>CSV format</span>
              <strong>Spenlio finance CSV</strong>
              <p>Includes named business SMS senders only and skips phone-number conversations.</p>
            </div>
          ) : (
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
          )}

          <details className="advanced-options export-advanced">
            <summary>{spenlioEdition ? "Optional filters and file layout" : "Advanced options"}</summary>
            <div className="advanced-option-grid advanced-option-grid--dates">
              <label className={`field ${startDateIssues.length > 0 ? "field--error" : ""}`} htmlFor="start-date">
                <span>Start date</span>
                <input
                  aria-describedby={startDateIssues.length > 0 ? "start-date-errors" : undefined}
                  aria-invalid={startDateIssues.length > 0}
                  id="start-date"
                  max={endDateBoundary}
                  onInput={(event) => update("startDate", event.currentTarget.value)}
                  type="date"
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
                  min={startDateBoundary}
                  onInput={(event) => update("endDate", event.currentTarget.value)}
                  type="date"
                  value={options.endDate}
                />
                <FieldIssues fieldId="end-date" issues={endDateIssues} />
              </label>
            </div>

            {options.format === "csv" ? (
              <fieldset>
                <legend>{spenlioEdition ? "Need separate files?" : "CSV layout"}</legend>
                <div className="csv-layout-list">
                  {availableCsvLayouts.map((layout) => (
                    <button
                      className={`csv-layout-option ${
                        options.csvLayout === layout.value ? "is-selected" : ""
                      }`}
                      key={layout.value}
                      onClick={() => update("csvLayout", layout.value)}
                      type="button"
                    >
                      <strong>{layout.label}</strong>
                      <small>{layout.description}</small>
                    </button>
                  ))}
                </div>
                <p className="field-hint">{csvLayoutHint}</p>
              </fieldset>
            ) : null}

            {!spenlioEdition ? (
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

                <div className="field">
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
              </div>
            ) : null}
          </details>
        </div>

        <aside className="export-summary-card" aria-label="Export summary">
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
            {!spenlioEdition && preflight.nonBlockingNotes.length > 0 ? (
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

          <div className="export-summary-actions">
            <button
              className="button button--primary"
              disabled={primaryActionDisabled}
              onClick={canPrepareExporter ? onPrepareExporter : onRun}
              type="button"
            >
              <PrimaryActionIcon aria-hidden="true" className={isLoading ? "spin" : undefined} />
              {primaryActionLabel}
            </button>
            <button
              className="button button--secondary"
              disabled={checkingOutputAccess}
              onClick={onCheckOutputAccess}
              type="button"
            >
              <ShieldCheck aria-hidden="true" />
              {checkingOutputAccess ? "Checking" : "Check save folder"}
            </button>
            <button
              className="button button--secondary"
              disabled={!outputValue}
              onClick={onOpenOutput}
              type="button"
            >
              <FolderOpen aria-hidden="true" />
              Open save folder
            </button>
          </div>

          <div className="output-preview" aria-label="What the export creates">
            <div>
              <span>What you will get</span>
              <strong>{formatPreviewTitle(options)}</strong>
              <p>{formatPreviewDescription(options)}</p>
            </div>
            <ul>
              {formatPreviewFiles(options, appName).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

    </section>
  );
}

function validDateInputBoundary(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : undefined;
}

function LocationReviewRow({
  chooseLabel,
  emptyValue,
  fieldId,
  hint,
  issues,
  label,
  onChoose,
  onOpen,
  openLabel,
  value,
}: {
  chooseLabel: string;
  emptyValue: string;
  fieldId: string;
  hint: string;
  issues: string[];
  label: string;
  onChoose: () => void;
  onOpen: () => void;
  openLabel: string;
  value: string;
}) {
  const hasValue = value.length > 0;
  return (
    <div className={`location-review-row ${issues.length > 0 ? "field--error" : ""}`}>
      <div className="location-review-main">
        <span className="field-label">{label}</span>
        <code className={`location-review-path ${hasValue ? "" : "is-empty"}`} title={hasValue ? value : undefined}>
          {hasValue ? value : emptyValue}
        </code>
        <p className="field-hint">{hint}</p>
        <FieldIssues fieldId={fieldId} issues={issues} />
      </div>
      <div className="location-review-actions">
        <button className="button button--secondary button--compact" onClick={onChoose} type="button">
          <FolderOpen aria-hidden="true" />
          {chooseLabel}
        </button>
        <button
          className="button button--secondary button--compact"
          disabled={!hasValue}
          onClick={onOpen}
          type="button"
        >
          <FolderOpen aria-hidden="true" />
          {openLabel}
        </button>
      </div>
    </div>
  );
}

function formatPreviewTitle(options: ExportOptions): string {
  if (options.format === "csv" && options.csvLayout === "spenlioCombined") {
    return "Spenlio-compatible message rows";
  }

  if (options.format === "csv" && options.csvLayout === "spenlioBySender") {
    return "Sender-grouped finance CSV files";
  }

  if (options.format === "csv") {
    return "Spreadsheet-friendly message rows";
  }

  if (options.format === "txt") {
    return "Plain transcript files";
  }

  return "Readable conversation pages";
}

function formatPreviewDescription(options: ExportOptions): string {
  if (options.format === "csv" && options.csvLayout === "spenlioCombined") {
    return "Best for importing into Spenlio or similar finance parsers. Uses sender, received_at, message_id, and message columns from the selected Messages source.";
  }

  if (options.format === "csv" && options.csvLayout === "spenlioBySender") {
    return "Best when you want separate files for each named business sender before importing or reviewing.";
  }

  if (options.format === "csv") {
    return "Best for a simple spreadsheet view of transcript lines.";
  }

  if (options.format === "txt") {
    return "Best for a simple long-term archive that opens in any text editor.";
  }

  return "Best for browsing your saved conversations later in a normal web browser.";
}

function formatPreviewFiles(options: ExportOptions, appName: string): string[] {
  const exportFolder = `${appName} export folder`;

  if (options.format === "csv" && options.csvLayout === "spenlioCombined") {
    return [exportFolder, "spenlio-sms-export.csv", "Apple message IDs when available"];
  }

  if (options.format === "csv" && options.csvLayout === "spenlioBySender") {
    return [exportFolder, "spenlio-sms-export-by-sender folder", "Apple message IDs when available"];
  }

  if (options.format === "csv") {
    return [exportFolder, "chatexportmate-transcript-lines.csv", "text transcripts used for conversion"];
  }

  if (options.format === "txt") {
    return [exportFolder, "conversation text files", "attachments folder when selected"];
  }

  return [exportFolder, "readable conversation HTML files", "attachments folder when selected"];
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
