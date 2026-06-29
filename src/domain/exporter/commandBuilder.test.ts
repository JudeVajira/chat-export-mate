import { describe, expect, it } from "vitest";
import {
  buildDiagnosticCommand,
  buildExporterCommand,
  usesStructuredCsvExport,
  validateExportOptions,
} from "./commandBuilder";
import type { ExportOptions } from "./types";

const baseOptions: ExportOptions = {
  format: "html",
  platform: "macOS",
  outputPath: "~/export output",
  databasePath: "/Users/me/Library/Messages/chat.db",
  encryptedBackup: false,
  attachmentRoot: "",
  copyMethod: "full",
  startDate: "2020-01-01",
  endDate: "2021-01-01",
  conversationFilter: "steve@apple.com,5558675309",
  customName: "",
  csvLayout: "spenlioCombined",
  useCallerId: false,
  noLazyImages: true,
  ignoreDiskWarning: false,
  noProgress: true,
};

describe("buildExporterCommand", () => {
  it("builds the supported imessage-exporter arguments", () => {
    const command = buildExporterCommand("imessage-exporter", baseOptions);

    expect(command.args).toEqual([
      "-f",
      "html",
      "-o",
      "~/export output",
      "-c",
      "full",
      "-a",
      "macOS",
      "-p",
      "/Users/me/Library/Messages/chat.db",
      "-s",
      "2020-01-01",
      "-e",
      "2021-01-01",
      "-t",
      "steve@apple.com,5558675309",
      "-l",
      "--no-progress",
    ]);
    expect(command.displayCommand).toContain("\"~/export output\"");
  });

  it("validates date ranges and conflicting identity options", () => {
    const issues = validateExportOptions("imessage-exporter", {
      ...baseOptions,
      startDate: "2021-01-01",
      endDate: "2020-01-01",
      customName: "Me",
      useCallerId: true,
    });

    expect(issues.map((issue) => issue.field)).toEqual(["endDate", "customName"]);
  });

  it("validates impossible calendar dates", () => {
    const issues = validateExportOptions("imessage-exporter", {
      ...baseOptions,
      startDate: "2024-02-31",
      endDate: "2024-13-01",
    });

    expect(issues).toEqual([
      {
        field: "startDate",
        message: "Start date must be a valid calendar date in YYYY-MM-DD format.",
      },
      {
        field: "endDate",
        message: "End date must be a valid calendar date in YYYY-MM-DD format.",
      },
    ]);
  });

  it("validates platform-specific source paths", () => {
    expect(
      validateExportOptions("imessage-exporter", {
        ...baseOptions,
        platform: "iOS",
        databasePath: "",
      }).map((issue) => issue.message),
    ).toContain("Choose the iPhone backup folder that contains the messages you want to save.");

    expect(
      validateExportOptions("imessage-exporter", {
        ...baseOptions,
        platform: "macOS",
        databasePath: "/Users/me/Messages",
      }).map((issue) => issue.message),
    ).toContain("macOS sources should point to a chat.db file when a custom source is provided.");

    expect(
      validateExportOptions("imessage-exporter", {
        ...baseOptions,
        platform: "iOS",
        databasePath: "/Users/me/Library/Messages/chat.db",
      }).map((issue) => issue.message),
    ).toContain("iOS sources should point to an iPhone backup folder, not a chat.db file.");

    expect(
      validateExportOptions("imessage-exporter", {
        ...baseOptions,
        platform: "iOS",
        databasePath: "/Users/me/Library/Application Support/MobileSync/Backup/ABC",
      }),
    ).toEqual([]);
  });

  it("builds advanced identity and safety arguments", () => {
    const command = buildExporterCommand("imessage-exporter", {
      ...baseOptions,
      customName: "Jude",
      ignoreDiskWarning: true,
      noLazyImages: false,
      noProgress: false,
      useCallerId: false,
    });

    expect(command.args).toContain("-m");
    expect(command.args).toContain("Jude");
    expect(command.args).toContain("-b");
    expect(command.args).not.toContain("-i");
    expect(command.args).not.toContain("-l");
    expect(command.args).not.toContain("--no-progress");
  });

  it("uses text exporter output when the user selects CSV conversion", () => {
    const command = buildExporterCommand("imessage-exporter", {
      ...baseOptions,
      format: "csv",
    });

    expect(command.requestedFormat).toBe("csv");
    expect(command.exporterFormat).toBe("txt");
    expect(command.csvLayout).toBe("spenlioCombined");
    expect(command.args.slice(0, 2)).toEqual(["-f", "txt"]);
  });

  it("does not require an exporter binary for structured finance CSV layouts", () => {
    const structuredCsvOptions: ExportOptions = {
      ...baseOptions,
      format: "csv",
      platform: "iOS",
      databasePath: "/Users/me/Library/Application Support/MobileSync/Backup/ABC",
      csvLayout: "spenlioCombined",
    };

    expect(usesStructuredCsvExport(structuredCsvOptions)).toBe(true);
    expect(validateExportOptions("", structuredCsvOptions)).toEqual([]);
    expect(
      validateExportOptions("", {
        ...structuredCsvOptions,
        csvLayout: "transcriptLines",
      }),
    ).toContainEqual({
      field: "executablePath",
      message: "Set up or choose an exporter before running an export.",
    });
  });

  it("builds iOS backup commands without macOS attachment roots", () => {
    const command = buildExporterCommand("imessage-exporter", {
      ...baseOptions,
      platform: "iOS",
      databasePath: "/Users/me/Library/Application Support/MobileSync/Backup/ABC",
      encryptedBackup: true,
      attachmentRoot: "/Users/me/Library/Messages/Attachments",
    });

    expect(command.args).toContain("iOS");
    expect(command.args).toContain("/Users/me/Library/Application Support/MobileSync/Backup/ABC");
    expect(command.args).not.toContain("-r");
    expect(command.args).not.toContain("--cleartext-password");
  });

  it("requires a current-run password only for encrypted iPhone backups", () => {
    const encryptedOptions: ExportOptions = {
      ...baseOptions,
      platform: "iOS",
      databasePath: "/Users/me/Library/Application Support/MobileSync/Backup/ABC",
      encryptedBackup: true,
    };

    expect(validateExportOptions("imessage-exporter", encryptedOptions)).toContainEqual({
      field: "backupPassword",
      message: "Enter the backup password for this encrypted iPhone backup.",
    });
    expect(
      validateExportOptions("imessage-exporter", encryptedOptions, {
        backupPassword: "correct horse battery staple",
      }),
    ).toEqual([]);
    expect(
      validateExportOptions("imessage-exporter", {
        ...encryptedOptions,
        encryptedBackup: false,
      }),
    ).toEqual([]);
  });

  it("builds upstream diagnostic arguments with optional source paths", () => {
    const command = buildDiagnosticCommand("imessage-exporter", {
      ...baseOptions,
      attachmentRoot: "/Users/me/Library/Messages",
    });

    expect(command.args).toEqual([
      "-d",
      "-a",
      "macOS",
      "-p",
      "/Users/me/Library/Messages/chat.db",
      "-r",
      "/Users/me/Library/Messages",
    ]);
  });

  it("keeps iOS diagnostics focused on the backup source", () => {
    const command = buildDiagnosticCommand("imessage-exporter", {
      ...baseOptions,
      platform: "iOS",
      databasePath: "/Users/me/Library/Application Support/MobileSync/Backup/ABC",
      attachmentRoot: "/Users/me/Library/Messages/Attachments",
    });

    expect(command.args).toEqual([
      "-d",
      "-a",
      "iOS",
      "-p",
      "/Users/me/Library/Application Support/MobileSync/Backup/ABC",
    ]);
  });
});
