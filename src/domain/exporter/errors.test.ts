import { describe, expect, it } from "vitest";
import { translateExporterError } from "./errors";

describe("translateExporterError", () => {
  it("recognizes macOS permission failures", () => {
    const error = translateExporterError("Operation not permitted while opening ~/Library/Messages/chat.db");

    expect(error.title).toBe("Messages data is blocked by system permissions");
    expect(error.suggestedFix).toContain("Full Disk Access");
  });

  it("falls back to a raw-detail error for unknown output", () => {
    const error = translateExporterError("totally new upstream failure");

    expect(error.title).toBe("The exporter stopped unexpectedly");
    expect(error.rawDetails).toBe("totally new upstream failure");
  });

  it("keeps encrypted iPhone backup advice inside the supported path", () => {
    const error = translateExporterError("encrypted backup requires password");

    expect(error.title).toBe("Backup could not be unlocked");
    expect(error.explanation).toBe(
      "The backup password did not work, or the backup could not be unlocked. Re-enter the password and try again.",
    );
    expect(error.suggestedFix).toContain("My backup is encrypted");
  });
});
