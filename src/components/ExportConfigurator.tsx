import { FolderOpen, Play, RotateCcw } from "lucide-react";
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
  dryRun: boolean;
  isRunning: boolean;
  onDryRunChange: (value: boolean) => void;
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
  dryRun,
  isRunning,
  onDryRunChange,
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

        <label className="field span-2">
          <span>Output folder</span>
          <div className="input-with-icon">
            <input
              onChange={(event) => update("outputPath", event.currentTarget.value)}
              value={options.outputPath}
            />
            <FolderOpen aria-hidden="true" />
          </div>
        </label>

        <label className="field span-2">
          <span>Custom source</span>
          <input
            onChange={(event) => update("databasePath", event.currentTarget.value)}
            placeholder={
              options.platform === "macOS"
                ? "~/Library/Messages/chat.db"
                : "~/Library/Application Support/MobileSync/Backup/..."
            }
            value={options.databasePath}
          />
        </label>

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
      </div>

      <div className="action-row">
        <div className="action-row-group">
          <button className="button button--secondary" onClick={() => onChange(options)} type="button">
            <RotateCcw aria-hidden="true" />
            Refresh preview
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
