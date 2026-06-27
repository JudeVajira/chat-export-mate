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
});
