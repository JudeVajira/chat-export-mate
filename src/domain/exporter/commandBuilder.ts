import type { BuiltCommand, ExportOptions, ValidationIssue } from "./types";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function validateExportOptions(
  executablePath: string,
  options: ExportOptions,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!executablePath.trim()) {
    issues.push({
      field: "executablePath",
      message: "Choose or install imessage-exporter before running an export.",
    });
  }

  if (!options.outputPath.trim()) {
    issues.push({
      field: "outputPath",
      message: "Choose an output folder for exported files.",
    });
  }

  if (
    options.databasePath &&
    options.platform === "macOS" &&
    !options.databasePath.endsWith("chat.db")
  ) {
    issues.push({
      field: "databasePath",
      message: "macOS sources should point to a chat.db file when a custom source is provided.",
    });
  }

  if (options.startDate && !datePattern.test(options.startDate)) {
    issues.push({
      field: "startDate",
      message: "Start date must use YYYY-MM-DD.",
    });
  }

  if (options.endDate && !datePattern.test(options.endDate)) {
    issues.push({
      field: "endDate",
      message: "End date must use YYYY-MM-DD.",
    });
  }

  if (
    options.startDate &&
    options.endDate &&
    datePattern.test(options.startDate) &&
    datePattern.test(options.endDate) &&
    options.startDate >= options.endDate
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

export function buildExporterCommand(
  executablePath: string,
  options: ExportOptions,
): BuiltCommand {
  const args: string[] = [
    "-f",
    options.format,
    "-o",
    options.outputPath,
    "-c",
    options.copyMethod,
    "-a",
    options.platform,
  ];

  pushValue(args, "-p", options.databasePath);
  pushValue(args, "-r", options.attachmentRoot);
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
  };
}

export function buildDiagnosticCommand(
  executablePath: string,
  options: ExportOptions,
): BuiltCommand {
  const args = ["-d", "-a", options.platform];

  pushValue(args, "-p", options.databasePath);
  pushValue(args, "-r", options.attachmentRoot);

  return {
    executablePath,
    args,
    displayCommand: formatDisplayCommand(executablePath, args),
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

function quoteForDisplay(value: string): string {
  if (!value) {
    return "\"\"";
  }

  if (!/[\s"']/u.test(value)) {
    return value;
  }

  return `"${value.replace(/\\/gu, "\\\\").replace(/"/gu, "\\\"")}"`;
}
