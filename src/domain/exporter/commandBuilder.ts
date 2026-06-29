import type { BuiltCommand, ExportOptions, ExportRuntimeSecrets, ValidationIssue } from "./types";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function validateExportOptions(
  executablePath: string,
  options: ExportOptions,
  runtimeSecrets: ExportRuntimeSecrets = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const structuredCsvExport = usesStructuredCsvExport(options);

  if (!executablePath.trim() && !structuredCsvExport) {
    issues.push({
      field: "executablePath",
      message: "Set up or choose an exporter before running an export.",
    });
  }

  if (!options.outputPath.trim()) {
    issues.push({
      field: "outputPath",
      message: "Choose an output folder for exported files.",
    });
  }

  const sourcePath = options.databasePath?.trim();
  if (!sourcePath && options.platform === "iOS") {
    issues.push({
      field: "databasePath",
      message: "Choose the iPhone backup folder that contains the messages you want to save.",
    });
  }

  if (sourcePath && options.platform === "macOS" && !isChatDatabasePath(sourcePath)) {
    issues.push({
      field: "databasePath",
      message: "macOS sources should point to a chat.db file when a custom source is provided.",
    });
  }

  if (sourcePath && options.platform === "iOS" && isChatDatabasePath(sourcePath)) {
    issues.push({
      field: "databasePath",
      message: "iOS sources should point to an iPhone backup folder, not a chat.db file.",
    });
  }

  if (options.platform === "iOS" && options.encryptedBackup && !runtimeSecrets.backupPassword?.trim()) {
    issues.push({
      field: "backupPassword",
      message: "Enter the backup password for this encrypted iPhone backup.",
    });
  }

  const parsedStartDate = parseDateOnly(options.startDate);
  const parsedEndDate = parseDateOnly(options.endDate);

  if (options.startDate && !parsedStartDate) {
    issues.push({
      field: "startDate",
      message: "Start date must be a valid calendar date in YYYY-MM-DD format.",
    });
  }

  if (options.endDate && !parsedEndDate) {
    issues.push({
      field: "endDate",
      message: "End date must be a valid calendar date in YYYY-MM-DD format.",
    });
  }

  if (
    parsedStartDate &&
    parsedEndDate &&
    parsedStartDate.getTime() >= parsedEndDate.getTime()
  ) {
    issues.push({
      field: "endDate",
      message: "End date must be after the start date. imessage-exporter treats the end date as exclusive.",
    });
  }

  if (options.customName?.trim() && options.useCallerId) {
    issues.push({
      field: "customName",
      message: "Custom name cannot be combined with caller ID mode.",
    });
  }

  return issues;
}

export function usesStructuredCsvExport(options: Pick<ExportOptions, "format" | "csvLayout">): boolean {
  return options.format === "csv" && options.csvLayout !== "transcriptLines";
}

export function buildExporterCommand(
  executablePath: string,
  options: ExportOptions,
): BuiltCommand {
  const exporterFormat = options.format === "csv" ? "txt" : options.format;
  const args: string[] = [
    "-f",
    exporterFormat,
    "-o",
    options.outputPath,
    "-c",
    options.copyMethod,
    "-a",
    options.platform,
  ];

  pushValue(args, "-p", options.databasePath);
  if (options.platform === "macOS") {
    pushValue(args, "-r", options.attachmentRoot);
  }
  pushValue(args, "-s", options.startDate);
  pushValue(args, "-e", options.endDate);
  pushValue(args, "-t", options.conversationFilter);
  pushValue(args, "-m", options.customName);

  if (options.useCallerId) {
    args.push("-i");
  }

  if (options.noLazyImages) {
    args.push("-l");
  }

  if (options.ignoreDiskWarning) {
    args.push("-b");
  }

  if (options.noProgress) {
    args.push("--no-progress");
  }

  return {
    executablePath,
    args,
    displayCommand: formatDisplayCommand(executablePath, args),
    requestedFormat: options.format,
    exporterFormat,
    csvLayout: options.csvLayout,
  };
}

export function buildDiagnosticCommand(
  executablePath: string,
  options: ExportOptions,
): BuiltCommand {
  const args = ["-d", "-a", options.platform];

  pushValue(args, "-p", options.databasePath);
  if (options.platform === "macOS") {
    pushValue(args, "-r", options.attachmentRoot);
  }

  return {
    executablePath,
    args,
    displayCommand: formatDisplayCommand(executablePath, args),
    requestedFormat: options.format,
    exporterFormat: options.format === "html" ? "html" : "txt",
  };
}

export function formatDisplayCommand(executablePath: string, args: string[]): string {
  return [executablePath, ...args].map(quoteForDisplay).join(" ");
}

function pushValue(args: string[], flag: string, value?: string): void {
  const trimmed = value?.trim();
  if (trimmed) {
    args.push(flag, trimmed);
  }
}

function isChatDatabasePath(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/\\/gu, "/");
  return normalized === "chat.db" || normalized.endsWith("/chat.db");
}

function parseDateOnly(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const match = datePattern.exec(value);
  if (!match) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

function quoteForDisplay(value: string): string {
  if (!value) {
    return "\"\"";
  }

  if (!/[\s"']/u.test(value)) {
    return value;
  }

  return `"${value.replace(/\\/gu, "\\\\").replace(/"/gu, "\\\"")}"`;
}
