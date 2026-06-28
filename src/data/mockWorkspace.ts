import type { ExportOptions } from "../domain/exporter/types";

export const defaultExecutablePath = "imessage-exporter";

export const defaultExportOptions: ExportOptions = {
  format: "html",
  platform: "macOS",
  outputPath: "~/imessage_export",
  databasePath: "",
  attachmentRoot: "",
  copyMethod: "full",
  startDate: "",
  endDate: "",
  conversationFilter: "",
  customName: "",
  useCallerId: false,
  noLazyImages: false,
  ignoreDiskWarning: false,
  noProgress: true,
};

export const initialLogEntries = [
  {
    time: "12:01",
    level: "info",
    message: "Workspace initialized in the local development harness.",
  },
  {
    time: "12:02",
    level: "warn",
    message: "Exporter detection needs the desktop app.",
  },
  {
    time: "12:03",
    level: "info",
    message: "Export options update locally before anything runs.",
  },
] as const;
