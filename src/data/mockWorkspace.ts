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
    message: "Workspace initialized in local preview mode.",
  },
  {
    time: "12:02",
    level: "warn",
    message: "Exporter detection needs the Tauri desktop runtime.",
  },
  {
    time: "12:03",
    level: "info",
    message: "Command preview updates locally before anything runs.",
  },
] as const;

