import { FolderOpen, SlidersHorizontal } from "lucide-react";
import type {
  AttachmentCopyMethod,
  CsvExportLayout,
  ExportOptions,
} from "../../domain/exporter/types";
import { FieldIssues } from "./FieldIssues";

const csvLayouts: Array<{ label: string; value: CsvExportLayout; description: string }> = [
  {
    label: "One finance CSV",
    value: "spenlioCombined",
    description: "A single Spenlio-ready file with business SMS senders only.",
  },
  {
    label: "One CSV per sender",
    value: "spenlioBySender",
    description: "A folder with a separate file for each business sender.",
  },
  {
    label: "Transcript lines",
    value: "transcriptLines",
    description: "One row per transcript line, for general review.",
  },
];

const copyMethods: Array<{ value: AttachmentCopyMethod; label: string }> = [
  { value: "full", label: "Copy attachments (recommended)" },
  { value: "clone", label: "Fast copy" },
  { value: "basic", label: "Basic copy" },
  { value: "disabled", label: "Skip attachments" },
];

export function AdvancedOptions({
  customNameIssues,
  endDateIssues,
  onChange,
  onPickAttachmentRoot,
  options,
  spenlioEdition,
  startDateIssues,
}: {
  customNameIssues: string[];
  endDateIssues: string[];
  onChange: (options: ExportOptions) => void;
  onPickAttachmentRoot: () => void;
  options: ExportOptions;
  spenlioEdition: boolean;
  startDateIssues: string[];
}) {
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
    <details className="advanced-options">
      <summary>
        <SlidersHorizontal aria-hidden="true" />
        {spenlioEdition ? "Date range and file layout" : "More options"}
      </summary>

      <div className="advanced-body">
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
        <p className="field-hint">Leave the dates empty to export everything.</p>

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
      </div>
    </details>
  );
}

function validDateInputBoundary(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : undefined;
}
