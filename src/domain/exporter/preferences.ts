import type { CsvExportLayout, ExportOptions, ExportPreferences } from "./types";
import { normalizeLocalPathForDisplay } from "./paths";

const defaultCsvLayout: CsvExportLayout = "spenlioCombined";

export function createExportPreferences(
  options: ExportOptions,
  dryRun: boolean,
  savedAt = new Date().toISOString(),
): ExportPreferences {
  return {
    schemaVersion: 1,
    options: normalizeExportOptions(options),
    dryRun,
    savedAt,
  };
}

export function applyExportPreferences(
  fallbackOptions: ExportOptions,
  fallbackDryRun: boolean,
  preferences: ExportPreferences | null,
): { options: ExportOptions; dryRun: boolean } {
  if (!preferences) {
    return {
      options: fallbackOptions,
      dryRun: fallbackDryRun,
    };
  }

  return {
    options: {
      ...fallbackOptions,
      ...normalizeExportOptions(preferences.options),
    },
    dryRun: preferences.dryRun,
  };
}

export function parseExportPreferences(value: string | null): ExportPreferences | null {
  if (!value) {
    return null;
  }

  try {
    return coerceExportPreferences(JSON.parse(value));
  } catch {
    return null;
  }
}

export function coerceExportPreferences(value: unknown): ExportPreferences | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.options)) {
    return null;
  }

  if (typeof value.dryRun !== "boolean" || typeof value.savedAt !== "string") {
    return null;
  }

  const options = coerceExportOptions(value.options);
  if (!options) {
    return null;
  }

  return {
    schemaVersion: 1,
    options,
    dryRun: value.dryRun,
    savedAt: value.savedAt,
  };
}

function normalizeExportOptions(options: ExportOptions): ExportOptions {
  return {
    format: options.format,
    platform: options.platform,
    outputPath: normalizeLocalPathForDisplay(options.outputPath),
    databasePath: normalizeLocalPathForDisplay(options.databasePath ?? ""),
    encryptedBackup: options.encryptedBackup ?? false,
    attachmentRoot: normalizeLocalPathForDisplay(options.attachmentRoot ?? ""),
    copyMethod: options.copyMethod,
    startDate: options.startDate ?? "",
    endDate: options.endDate ?? "",
    conversationFilter: options.conversationFilter ?? "",
    customName: options.customName ?? "",
    csvLayout: normalizeCsvLayout(options.csvLayout),
    useCallerId: options.useCallerId,
    noLazyImages: options.noLazyImages,
    ignoreDiskWarning: options.ignoreDiskWarning,
    noProgress: options.noProgress,
  };
}

function coerceExportOptions(value: Record<string, unknown>): ExportOptions | null {
  if (
    (value.format !== "html" && value.format !== "txt" && value.format !== "csv") ||
    (value.platform !== "macOS" && value.platform !== "iOS") ||
    (value.copyMethod !== "disabled" &&
      value.copyMethod !== "clone" &&
      value.copyMethod !== "basic" &&
      value.copyMethod !== "full")
  ) {
    return null;
  }

  const encryptedBackup = value.encryptedBackup ?? false;
  if (typeof encryptedBackup !== "boolean") {
    return null;
  }

  if (
    typeof value.outputPath !== "string" ||
    typeof value.useCallerId !== "boolean" ||
    typeof value.noLazyImages !== "boolean" ||
    typeof value.ignoreDiskWarning !== "boolean" ||
    typeof value.noProgress !== "boolean"
  ) {
    return null;
  }

  return {
    format: value.format,
    platform: value.platform,
    outputPath: normalizeLocalPathForDisplay(value.outputPath),
    databasePath: normalizeLocalPathForDisplay(optionalString(value.databasePath)),
    encryptedBackup,
    attachmentRoot: normalizeLocalPathForDisplay(optionalString(value.attachmentRoot)),
    copyMethod: value.copyMethod,
    startDate: optionalString(value.startDate),
    endDate: optionalString(value.endDate),
    conversationFilter: optionalString(value.conversationFilter),
    customName: optionalString(value.customName),
    csvLayout: normalizeCsvLayout(value.csvLayout),
    useCallerId: value.useCallerId,
    noLazyImages: value.noLazyImages,
    ignoreDiskWarning: value.ignoreDiskWarning,
    noProgress: value.noProgress,
  };
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeCsvLayout(value: unknown): CsvExportLayout {
  return value === "spenlioBySender" || value === "transcriptLines"
    ? value
    : defaultCsvLayout;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
