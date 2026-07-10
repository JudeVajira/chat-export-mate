import { useState } from "react";
import { FolderOpen, SlidersHorizontal } from "lucide-react";
import type {
  AttachmentCopyMethod,
  CsvExportLayout,
  ExportOptions,
} from "../../domain/exporter/types";
import { FieldIssues } from "./FieldIssues";

const csvLayouts: Array<{ label: string; value: CsvExportLayout; description: string }> = [
  {
    label: "All messages",
    value: "transcriptLines",
    description: "One row per transcript line from every conversation. Text only.",
  },
  {
    label: "Spenlio finance CSV",
    value: "spenlioCombined",
    description: "Spenlio-ready columns (sender, received_at, message_id, message). Business SMS senders only.",
  },
  {
    label: "Spenlio finance CSV, per sender",
    value: "spenlioBySender",
    description: "Same Spenlio columns, one file per business sender.",
  },
];

const copyMethods: Array<{ value: AttachmentCopyMethod; label: string }> = [
  { value: "full", label: "Copy attachments (recommended)" },
  { value: "clone", label: "Fast copy" },
  { value: "basic", label: "Basic copy" },
  { value: "disabled", label: "Skip attachments" },
];

export function AdvancedOptions({
  commandPreview,
  customNameIssues,
  endDateIssues,
  onChange,
  onPickAttachmentRoot,
  options,
  spenlioEdition,
  startDateIssues,
}: {
  commandPreview: string | null;
  customNameIssues: string[];
  endDateIssues: string[];
  onChange: (options: ExportOptions) => void;
  onPickAttachmentRoot: () => void;
  options: ExportOptions;
  spenlioEdition: boolean;
  startDateIssues: string[];
}) {
  // Spenlio users pick a date range every month, so their options start open.
  const [open, setOpen] = useState(spenlioEdition);
  const update = <Key extends keyof ExportOptions>(key: Key, value: ExportOptions[Key]) => {
    onChange({ ...options, [key]: value });
  };
  const isIosSource = options.platform === "iOS";
  const startDateBoundary = validDateInputBoundary(options.startDate);
  const endDateBoundary = validDateInputBoundary(options.endDate);
  const availableCsvLayouts = spenlioEdition
    ? csvLayouts.filter((layout) => layout.value !== "transcriptLines")
    : csvLayouts;

  return (
    <details
      className="advanced-options"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary>
        <SlidersHorizontal aria-hidden="true" />
        {spenlioEdition ? "Date range and file layout" : "More options"}
      </summary>

      <div className="advanced-body">
        <div className="date-presets" role="group" aria-label="Date range shortcuts">
          <button
            className="button button--secondary button--compact"
            onClick={() => onChange({ ...options, ...monthRange(0) })}
            type="button"
          >
            This month
          </button>
          <button
            className="button button--secondary button--compact"
            onClick={() => onChange({ ...options, ...monthRange(-1) })}
            type="button"
          >
            Last month
          </button>
          {options.startDate || options.endDate ? (
            <button
              className="button button--ghost button--compact"
              onClick={() => onChange({ ...options, startDate: "", endDate: "" })}
              type="button"
            >
              Clear dates
            </button>
          ) : null}
        </div>
        <div className="advanced-grid advanced-grid--dates">
          <label className={`field ${startDateIssues.length > 0 ? "field--error" : ""}`} htmlFor="start-date">
            <span>From date</span>
            <input
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
            <span>To date</span>
            <input
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
        <p className="field-hint">
          Leave the dates empty to export everything. Both dates are included in the export.
        </p>

        {options.format === "csv" ? (
          <fieldset className="advanced-fieldset">
            <legend>{spenlioEdition ? "File layout" : "Spreadsheet layout"}</legend>
            <div className="csv-layout-list">
              {availableCsvLayouts.map((layout) => (
                <button
                  className={`csv-layout-option ${options.csvLayout === layout.value ? "is-selected" : ""}`}
                  key={layout.value}
                  onClick={() => update("csvLayout", layout.value)}
                  type="button"
                >
                  <strong>{layout.label}</strong>
                  <small>{layout.description}</small>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {!spenlioEdition ? (
          <>
            <div className="advanced-grid">
              <label className="field" htmlFor="conversation-filter">
                <span>Only conversations with</span>
                <input
                  id="conversation-filter"
                  onChange={(event) => update("conversationFilter", event.currentTarget.value)}
                  placeholder="Name, phone, or email (optional)"
                  value={options.conversationFilter}
                />
              </label>

              <label
                className={`field ${customNameIssues.length > 0 ? "field--error" : ""}`}
                htmlFor="custom-export-name"
              >
                <span>Your name in transcripts</span>
                <input
                  aria-invalid={customNameIssues.length > 0}
                  id="custom-export-name"
                  onChange={(event) => update("customName", event.currentTarget.value)}
                  placeholder="Shown instead of “Me” (optional)"
                  value={options.customName}
                />
                <FieldIssues fieldId="custom-export-name" issues={customNameIssues} />
              </label>
            </div>

            {options.format !== "csv" ? (
              <div className="advanced-grid">
                <label className="field" htmlFor="copy-method">
                  <span>Attachments</span>
                  <select
                    id="copy-method"
                    onChange={(event) => update("copyMethod", event.currentTarget.value as AttachmentCopyMethod)}
                    value={options.copyMethod}
                  >
                    {copyMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </label>

                {!isIosSource ? (
                  <div className="field">
                    <label className="field-label" htmlFor="attachment-root">
                      Attachments folder
                    </label>
                    <div className="input-with-action">
                      <input
                        id="attachment-root"
                        onChange={(event) => update("attachmentRoot", event.currentTarget.value)}
                        placeholder="Only if attachments were moved (optional)"
                        value={options.attachmentRoot}
                      />
                      <button
                        aria-label="Choose attachments folder"
                        className="field-action"
                        onClick={onPickAttachmentRoot}
                        type="button"
                      >
                        <FolderOpen aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="advanced-toggles">
              <label className="switch-row switch-row--compact">
                <input
                  checked={options.useCallerId}
                  onChange={(event) => update("useCallerId", event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>
                  <strong>Show caller ID numbers</strong>
                </span>
              </label>
              {options.format === "html" ? (
                <label className="switch-row switch-row--compact">
                  <input
                    checked={options.noLazyImages}
                    onChange={(event) => update("noLazyImages", event.currentTarget.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Printer-ready images</strong>
                  </span>
                </label>
              ) : null}
              <label className="switch-row switch-row--compact">
                <input
                  checked={options.ignoreDiskWarning}
                  onChange={(event) => update("ignoreDiskWarning", event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>
                  <strong>Skip the free-disk-space check</strong>
                </span>
              </label>
            </div>
          </>
        ) : null}

        {!spenlioEdition ? (
          <div className="command-preview">
            <span>{commandPreview ? "Command this export will run" : "How this export runs"}</span>
            {commandPreview ? (
              <code>{commandPreview}</code>
            ) : (
              <p>The app reads the Messages database directly with its built-in local reader — no external command.</p>
            )}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function validDateInputBoundary(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : undefined;
}

function monthRange(monthOffset: number): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
  return { startDate: toDateInput(start), endDate: toDateInput(end) };
}

function toDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
