import { FolderOpen, Play, ShieldCheck } from "lucide-react";
import type {
  AttachmentCopyMethod,
  ExportFormat,
  ExportOptions,
  ExportPlatform,
} from "../domain/exporter/types";

interface ExportConfiguratorProps {
  options: ExportOptions;
  onChange: (options: ExportOptions) => void;
  canRun: boolean;
  checkingOutputAccess: boolean;
  dryRun: boolean;
  isRunning: boolean;
  onCheckOutputAccess: () => void;
  onDryRunChange: (value: boolean) => void;
  onPickAttachmentRoot: () => void;
  onPickDatabase: () => void;
  onPickOutput: () => void;
  onOpenOutput: () => void;
  onRun: () => void;
}

const formats: ExportFormat[] = ["html", "txt"];
const platforms: ExportPlatform[] = ["macOS", "iOS"];
const copyMethods: AttachmentCopyMethod[] = ["disabled", "clone", "basic", "full"];

export function ExportConfigurator({
  options,
  onChange,
  canRun,
  checkingOutputAccess,
  dryRun,
  isRunning,
  onCheckOutputAccess,
  onDryRunChange,
  onPickAttachmentRoot,
  onPickDatabase,
  onPickOutput,
  onOpenOutput,
  onRun,
}: ExportConfiguratorProps) {
  const update = <Key extends keyof ExportOptions>(key: Key, value: ExportOptions[Key]) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <section className="panel export-panel" aria-labelledby="export-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Export</p>
          <h2 id="export-title">Choose export</h2>
        </div>
        <label className="toggle">
          <input
            checked={dryRun}
            onChange={(event) => onDryRunChange(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>Dry run</span>
        </label>
      </div>

      <div className="config-grid">
        <fieldset>
          <legend>Format</legend>
          <div className="segmented-control">
            {formats.map((format) => (
              <button
                className={options.format === format ? "is-selected" : ""}
                key={format}
                onClick={() => update("format", format)}
                type="button"
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Source</legend>
          <div className="segmented-control">
            {platforms.map((platform) => (
              <button
                className={options.platform === platform ? "is-selected" : ""}
                key={platform}
                onClick={() => update("platform", platform)}
                type="button"
              >
                {platform}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="field span-2">
          <label className="field-label" htmlFor="output-folder">
            Output folder
          </label>
          <div className="input-with-action">
            <input
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
        </div>

        <div className="field span-2">
          <label className="field-label" htmlFor="custom-source">
            Custom source
          </label>
          <div className="input-with-action">
            <input
              id="custom-source"
              onChange={(event) => update("databasePath", event.currentTarget.value)}
              placeholder={
                options.platform === "macOS"
                  ? "~/Library/Messages/chat.db"
                  : "~/Library/Application Support/MobileSync/Backup/..."
              }
              value={options.databasePath}
            />
            <button
              className="field-action"
              onClick={onPickDatabase}
              title="Choose Messages database"
              type="button"
            >
              <FolderOpen aria-hidden="true" />
            </button>
          </div>
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
              id="attachment-root"
              onChange={(event) => update("attachmentRoot", event.currentTarget.value)}
              placeholder="Optional folder for Messages attachments"
              value={options.attachmentRoot}
            />
            <button
              className="field-action"
              onClick={onPickAttachmentRoot}
              title="Choose attachments folder"
              type="button"
            >
              <FolderOpen aria-hidden="true" />
            </button>
          </div>
        </div>

        <label className="field">
          <span>Start date</span>
          <input
            onChange={(event) => update("startDate", event.currentTarget.value)}
            placeholder="YYYY-MM-DD"
            value={options.startDate}
          />
        </label>

        <label className="field">
          <span>End date</span>
          <input
            onChange={(event) => update("endDate", event.currentTarget.value)}
            placeholder="YYYY-MM-DD"
            value={options.endDate}
          />
        </label>

        <div className="advanced-options span-2">
          <div className="advanced-options-heading">
            <h3>Advanced options</h3>
          </div>
          <div className="advanced-option-grid">
            <label className="field">
              <span>Custom export name</span>
              <input
                onChange={(event) => update("customName", event.currentTarget.value)}
                placeholder="Optional display name"
                value={options.customName}
              />
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
        </div>
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
          disabled={isRunning || (!canRun && !dryRun)}
          onClick={onRun}
          type="button"
        >
          <Play aria-hidden="true" />
          {isRunning ? "Running export" : dryRun ? "Start dry run" : "Start export"}
        </button>
      </div>
    </section>
  );
}
