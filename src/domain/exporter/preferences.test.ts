import { describe, expect, it } from "vitest";
import {
  applyExportPreferences,
  createExportPreferences,
  parseExportPreferences,
} from "./preferences";
import type { ExportOptions } from "./types";

const defaultOptions: ExportOptions = {
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

describe("export preferences", () => {
  it("creates a normalized preference payload", () => {
    expect(
      createExportPreferences(
        {
          ...defaultOptions,
          databasePath: undefined,
          customName: undefined,
          outputPath: "D:/Exports",
        },
        false,
        "2026-06-27T09:00:00.000Z",
      ),
    ).toEqual({
      schemaVersion: 1,
      dryRun: false,
      savedAt: "2026-06-27T09:00:00.000Z",
      options: {
        ...defaultOptions,
        databasePath: "",
        customName: "",
        outputPath: "D:/Exports",
      },
    });
  });

  it("applies saved preferences over defaults", () => {
    const preferences = createExportPreferences(
      {
        ...defaultOptions,
        format: "txt",
        platform: "iOS",
        copyMethod: "disabled",
        outputPath: "D:/Backups",
      },
      false,
      "2026-06-27T09:00:00.000Z",
    );

    expect(applyExportPreferences(defaultOptions, true, preferences)).toEqual({
      dryRun: false,
      options: {
        ...defaultOptions,
        format: "txt",
        platform: "iOS",
        copyMethod: "disabled",
        outputPath: "D:/Backups",
      },
    });
  });

  it("returns fallbacks when no preference payload exists", () => {
    expect(applyExportPreferences(defaultOptions, true, null)).toEqual({
      dryRun: true,
      options: defaultOptions,
    });
  });

  it("parses valid stored JSON and rejects invalid payloads", () => {
    const preferences = createExportPreferences(defaultOptions, true, "2026-06-27T09:00:00.000Z");

    expect(parseExportPreferences(JSON.stringify(preferences))).toEqual(preferences);
    expect(parseExportPreferences("{not-json")).toBeNull();
    expect(
      parseExportPreferences(
        JSON.stringify({
          ...preferences,
          options: {
            ...preferences.options,
            format: "pdf",
          },
        }),
      ),
    ).toBeNull();
  });
});
