import type { ExportOptions } from "../domain/exporter/types";

export const defaultExecutablePath = "imessage-exporter";

export const defaultExportOptions: ExportOptions = {
  format: "html",
  platform: "macOS",
  outputPath: "~/imessage_export",
  databasePath: "",
  encryptedBackup: false,
  attachmentRoot: "",
  copyMethod: "full",
  startDate: "",
  endDate: "",
  conversationFilter: "",
  customName: "",
  csvLayout: "transcriptLines",
  useCallerId: false,
  noLazyImages: false,
  ignoreDiskWarning: false,
  noProgress: true,
};

