import { describe, expect, it } from "vitest";
import type { ExportOptions } from "./types";
import {
  alignSourcePlatformToHost,
  defaultSourcePlatformForHost,
  shouldShowMacSourceChoice,
} from "./platformDefaults";

const baseOptions: ExportOptions = {
  format: "html",
  platform: "macOS",
  outputPath: "~/imessage_export",
  databasePath: "",
  encryptedBackup: false,
  attachmentRoot: "/Users/me/Library/Messages/Attachments",
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

describe("platformDefaults", () => {
  it("defaults Windows hosts to iPhone backup sources", () => {
    expect(defaultSourcePlatformForHost({ os: "windows" })).toBe("iOS");
    expect(shouldShowMacSourceChoice({ os: "windows" })).toBe(false);
  });

  it("keeps Mac hosts on Mac Messages sources", () => {
    expect(defaultSourcePlatformForHost({ os: "macos" })).toBe("macOS");
    expect(defaultSourcePlatformForHost({ os: "darwin" })).toBe("macOS");
    expect(shouldShowMacSourceChoice({ os: "macos" })).toBe(true);
  });

  it("aligns an empty Windows source to iPhone backup and clears Mac-only attachment roots", () => {
    expect(alignSourcePlatformToHost(baseOptions, { os: "windows" })).toMatchObject({
      platform: "iOS",
      attachmentRoot: "",
    });
  });

  it("does not rewrite a user-selected source path", () => {
    const selected = {
      ...baseOptions,
      databasePath: "C:/Users/me/AppData/Roaming/Apple Computer/MobileSync/Backup/device",
    };

    expect(alignSourcePlatformToHost(selected, { os: "windows" })).toBe(selected);
  });
});
