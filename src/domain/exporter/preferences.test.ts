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
  encryptedBackup: false,
  attachmentRoot: "",
  copyMethod: "full",
  startDate: "",
  endDate: "",
  conversationFilter: "",
  customName: "",
  csvLayout: "spenlioCombined",
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

  it("accepts CSV as an app-owned export format", () => {
    const preferences = createExportPreferences(
      {
        ...defaultOptions,
        format: "csv",
      },
      false,
      "2026-06-27T09:00:00.000Z",
    );

    expect(parseExportPreferences(JSON.stringify(preferences))?.options.format).toBe("csv");
  });

  it("defaults older preference payloads to the combined Spenlio CSV layout", () => {
    const preferences = createExportPreferences(defaultOptions, false, "2026-06-27T09:00:00.000Z");
    const olderOptions: Record<string, unknown> = { ...preferences.options };
    delete olderOptions.csvLayout;
    const olderPayload = {
      ...preferences,
      options: {
        ...olderOptions,
        format: "csv",
      },
    };

    expect(parseExportPreferences(JSON.stringify(olderPayload))?.options.csvLayout).toBe("spenlioCombined");
  });

  it("keeps the selected CSV layout in preferences", () => {
    const preferences = createExportPreferences(
      {
        ...defaultOptions,
        format: "csv",
        csvLayout: "spenlioBySender",
      },
      false,
      "2026-06-27T09:00:00.000Z",
    );

    expect(parseExportPreferences(JSON.stringify(preferences))?.options.csvLayout).toBe("spenlioBySender");
  });

  it("does not serialize volatile backup password fields", () => {
    const preferences = createExportPreferences(
      {
        ...defaultOptions,
        platform: "iOS",
        databasePath: "C:/Users/Jude/Apple/MobileSync/Backup/device",
        encryptedBackup: true,
        backupPassword: "never-write-this",
      } as ExportOptions & { backupPassword: string },
      false,
      "2026-06-27T09:00:00.000Z",
    );
    const serialized = JSON.stringify(preferences);

    expect(preferences.options.encryptedBackup).toBe(true);
    expect(serialized).not.toContain("never-write-this");
    expect(serialized).not.toContain("backupPassword");
  });
});
