import { describe, expect, it } from "vitest";
import { describeManagedState, getInstallActionLabel, isManagedStoreReady } from "./manager";

describe("exporter manager helpers", () => {
  it("labels install, update, and reinstall actions from probe state", () => {
    expect(getInstallActionLabel({ found: false }, false)).toBe("Install exporter");
    expect(getInstallActionLabel({ found: true }, true)).toBe("Update exporter");
    expect(getInstallActionLabel({ found: true }, false)).toBe("Reinstall exporter");
  });

  it("describes the active managed version when present", () => {
    expect(
      describeManagedState({
        installRoot: "C:/Users/me/AppData/Roaming/com.chatexportmate.app/exporter",
        activePath: "C:/Users/me/AppData/Roaming/com.chatexportmate.app/exporter/versions/4.2.0/imessage-exporter.exe",
        activeVersion: "4.2.0",
        installedVersions: ["4.2.0"],
      }),
    ).toContain("Active 4.2.0");
  });

  it("treats missing install roots and errors as not ready", () => {
    expect(isManagedStoreReady({ installRoot: "", installedVersions: [] })).toBe(false);
    expect(isManagedStoreReady({ installRoot: "store", installedVersions: [], error: "denied" })).toBe(false);
    expect(isManagedStoreReady({ installRoot: "store", installedVersions: [] })).toBe(true);
  });
});

