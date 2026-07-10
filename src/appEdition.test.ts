import { describe, expect, it } from "vitest";
import { applyEditionDefaults, enforceEditionOptions } from "./appEdition";
import { defaultExportOptions } from "./data/mockWorkspace";

describe("app edition configuration", () => {
  it("keeps general export options unchanged", () => {
    expect(enforceEditionOptions(defaultExportOptions, "general")).toEqual(defaultExportOptions);
  });

  it("defaults the Spenlio edition to iPhone finance CSV", () => {
    expect(applyEditionDefaults(defaultExportOptions, "spenlio")).toMatchObject({
      format: "csv",
      platform: "iOS",
      csvLayout: "spenlioCombined",
      copyMethod: "disabled",
      noProgress: true,
      outputPath: "~/spenlio_sms_export",
    });
  });

  it("prevents old preferences from restoring general export choices in the Spenlio edition", () => {
    expect(
      enforceEditionOptions(
        {
          ...defaultExportOptions,
          format: "html",
          platform: "macOS",
          csvLayout: "transcriptLines",
          attachmentRoot: "~/Library/Messages/Attachments",
          copyMethod: "full",
          conversationFilter: "BANK",
          customName: "Archive",
          useCallerId: true,
          noLazyImages: true,
          ignoreDiskWarning: true,
          noProgress: false,
        },
        "spenlio",
      ),
    ).toMatchObject({
      format: "csv",
      platform: "iOS",
      csvLayout: "spenlioCombined",
      attachmentRoot: "",
      copyMethod: "disabled",
      conversationFilter: "",
      customName: "",
      useCallerId: false,
      noLazyImages: false,
      ignoreDiskWarning: false,
      noProgress: true,
    });
  });

  it("allows the Spenlio per-sender layout as the only alternate layout", () => {
    expect(
      enforceEditionOptions(
        {
          ...defaultExportOptions,
          format: "csv",
          csvLayout: "spenlioBySender",
        },
        "spenlio",
      ).csvLayout,
    ).toBe("spenlioBySender");
  });
});
