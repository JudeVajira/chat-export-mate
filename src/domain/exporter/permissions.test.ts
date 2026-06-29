import { describe, expect, it } from "vitest";
import { buildPermissionGuide } from "./permissions";
import type { ExportOptions, OutputAccessCheck, SystemSnapshot } from "./types";

const macSnapshot: SystemSnapshot = {
  os: "macOS",
  arch: "arm64",
  family: "darwin",
  default_exporter_name: "imessage-exporter",
};

const windowsSnapshot: SystemSnapshot = {
  os: "windows",
  arch: "x64",
  family: "windows",
  default_exporter_name: "imessage-exporter.exe",
};

const macOptions: ExportOptions = {
  format: "html",
  platform: "macOS",
  outputPath: "C:/exports",
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

const writableOutput: OutputAccessCheck = {
  path: "C:/exports",
  resolvedPath: "C:/exports",
  writable: true,
  checkedAt: "2026-06-27T10:00:00Z",
  detail: "Output folder is writable.",
  error: null,
};

describe("buildPermissionGuide", () => {
  it("guides macOS users to grant Full Disk Access for Messages exports", () => {
    const guide = buildPermissionGuide(macSnapshot, macOptions, writableOutput);

    const source = guide.items.find((item) => item.id === "macos-full-disk-access");

    expect(source).toMatchObject({
      label: "Messages database access",
      state: "action",
      reference: {
        label: "Apple Full Disk Access settings",
      },
    });
    expect(source?.steps.join(" ")).toContain("System Settings > Privacy & Security > Full Disk Access");
  });

  it("marks macOS database access as review-only in Windows development", () => {
    const guide = buildPermissionGuide(windowsSnapshot, macOptions, writableOutput);

    const source = guide.items.find((item) => item.id === "macos-full-disk-access");

    expect(source).toMatchObject({
      state: "warning",
      detail: "Review this on the Mac that contains the Messages database; Windows development cannot verify it.",
    });
  });

  it("marks iOS backup access as actionable until a backup folder is selected", () => {
    const guide = buildPermissionGuide(windowsSnapshot, { ...macOptions, platform: "iOS" });

    const source = guide.items.find((item) => item.id === "ios-backup-access");

    expect(source).toMatchObject({
      label: "iPhone backup access",
      state: "action",
    });
    expect(source?.steps).toContain("Choose the backup folder in ChatExportMate.");
  });

  it("passes iOS backup access once a local backup folder is selected", () => {
    const guide = buildPermissionGuide(windowsSnapshot, {
      ...macOptions,
      platform: "iOS",
      databasePath: "C:/Users/Jude/Apple/MobileSync/Backup/device",
    });

    expect(guide.items.find((item) => item.id === "ios-backup-access")).toMatchObject({
      state: "passed",
      detail: "A local iPhone backup folder is selected for the export source.",
    });
  });

  it("uses output access results for destination guidance", () => {
    const guide = buildPermissionGuide(macSnapshot, macOptions, {
      ...writableOutput,
      writable: false,
      detail: "Output path points to a file. Choose a folder instead.",
      error: "not a directory",
    });

    expect(guide.items.find((item) => item.id === "destination-access")).toMatchObject({
      state: "action",
      detail: "Output path points to a file. Choose a folder instead.",
    });
  });
});
