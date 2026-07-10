import { describe, expect, it } from "vitest";
import {
  normalizeLocalPathForDisplay,
  normalizeLocalPathTextForDisplay,
  normalizeOptionalLocalPathForDisplay,
} from "./paths";

describe("path display helpers", () => {
  it("removes the Windows extended-length prefix from drive paths", () => {
    expect(normalizeLocalPathForDisplay("\\\\?\\D:\\Backups\\Device")).toBe(
      "D:\\Backups\\Device",
    );
  });

  it("removes the Windows NT object-manager prefix from drive paths", () => {
    expect(normalizeLocalPathForDisplay("\\??\\D:\\Backups\\Device")).toBe(
      "D:\\Backups\\Device",
    );
  });

  it("converts extended UNC paths back to normal UNC paths", () => {
    expect(normalizeLocalPathForDisplay("\\\\?\\UNC\\server\\share\\Backup")).toBe(
      "\\\\server\\share\\Backup",
    );
  });

  it("handles slash-style extended paths returned by some adapters", () => {
    expect(normalizeLocalPathForDisplay("//?/D:/Backups/Device")).toBe(
      "D:/Backups/Device",
    );
    expect(normalizeLocalPathForDisplay("//?/UNC/server/share/Backup")).toBe(
      "//server/share/Backup",
    );
  });

  it("keeps regular local paths unchanged", () => {
    expect(normalizeLocalPathForDisplay("D:\\Backups\\Device")).toBe(
      "D:\\Backups\\Device",
    );
    expect(normalizeLocalPathForDisplay("~/spenlio_sms_export")).toBe(
      "~/spenlio_sms_export",
    );
  });

  it("normalizes optional values for rendering", () => {
    expect(normalizeOptionalLocalPathForDisplay(null)).toBe("");
    expect(normalizeOptionalLocalPathForDisplay(undefined)).toBe("");
  });

  it("normalizes extended paths inside display text", () => {
    expect(
      normalizeLocalPathTextForDisplay(
        "Saved to \\\\?\\D:\\Exports and \\\\?\\UNC\\server\\share\\Backup",
      ),
    ).toBe("Saved to D:\\Exports and \\\\server\\share\\Backup");
  });
});
