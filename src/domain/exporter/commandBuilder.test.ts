import { describe, expect, it } from "vitest";
import { buildDiagnosticCommand, buildExporterCommand, validateExportOptions } from "./commandBuilder";
import type { ExportOptions } from "./types";

const baseOptions: ExportOptions = {
  format: "html",
  platform: "macOS",
  outputPath: "~/export output",
  databasePath: "/Users/me/Library/Messages/chat.db",
  attachmentRoot: "",
  copyMethod: "full",
  startDate: "2020-01-01",
  endDate: "2021-01-01",
  conversationFilter: "steve@apple.com,5558675309",
  customName: "",
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

  it("builds iOS backup commands without macOS attachment roots", () => {
    const command = buildExporterCommand("imessage-exporter", {
      ...baseOptions,
      platform: "iOS",
      databasePath: "/Users/me/Library/Application Support/MobileSync/Backup/ABC",
      attachmentRoot: "/Users/me/Library/Messages/Attachments",
    });

    expect(command.args).toContain("iOS");
    expect(command.args).toContain("/Users/me/Library/Application Support/MobileSync/Backup/ABC");
    expect(command.args).not.toContain("-r");
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
