import type { CsvExportLayout, ExportOptions } from "./domain/exporter/types";

export type AppEdition = "general" | "spenlio";

export const appEdition: AppEdition = normalizeAppEdition(import.meta.env.VITE_APP_EDITION);

export const isSpenlioEdition = appEdition === "spenlio";

export const appName = isSpenlioEdition ? "Spenlio SMS Exporter" : "ChatExportMate";

export const appSubtitle = isSpenlioEdition ? "finance SMS CSV" : "message archive";

export function applyEditionDefaults(options: ExportOptions, edition: AppEdition = appEdition): ExportOptions {
  if (edition !== "spenlio") {
    return options;
  }

  return enforceEditionOptions(
    {
      ...options,
      format: "csv",
      platform: "iOS",
      outputPath: options.outputPath === "~/imessage_export" ? "~/spenlio_sms_export" : options.outputPath,
      csvLayout: "spenlioCombined",
      copyMethod: "disabled",
      noProgress: true,
    },
    edition,
  );
}

export function enforceEditionOptions(options: ExportOptions, edition: AppEdition = appEdition): ExportOptions {
  if (edition !== "spenlio") {
    return options;
  }

  return {
    ...options,
    format: "csv",
    platform: "iOS",
    attachmentRoot: "",
    copyMethod: "disabled",
    conversationFilter: "",
    customName: "",
    csvLayout: normalizeSpenlioCsvLayout(options.csvLayout),
    useCallerId: false,
    noLazyImages: false,
    ignoreDiskWarning: false,
    noProgress: true,
  };
}

function normalizeSpenlioCsvLayout(layout: CsvExportLayout): CsvExportLayout {
  return layout === "spenlioBySender" ? layout : "spenlioCombined";
}

function normalizeAppEdition(value: unknown): AppEdition {
  return value === "spenlio" ? "spenlio" : "general";
}
