import { describe, expect, it } from "vitest";
import {
  describeProbeSource,
  describeManagedState,
  getActivatableManagedVersions,
  getInstallActionLabel,
  getReleaseStatusLabel,
  getUpdateStatusLabel,
  isCustomExporterProbe,
  isManagedStoreReady,
} from "./manager";

describe("exporter manager helpers", () => {
  it("labels install, update, and reinstall actions from probe state", () => {
    expect(getInstallActionLabel({ found: false }, false)).toBe("Install exporter");
    expect(getInstallActionLabel({ found: true, managed: true, source: "managed" }, true)).toBe(
      "Update exporter",
    );
    expect(getInstallActionLabel({ found: true, managed: true, source: "managed" }, false)).toBe(
      "Reinstall exporter",
    );
    expect(getInstallActionLabel({ found: true, source: "custom" }, true)).toBe(
      "Install managed update",
    );
    expect(getInstallActionLabel({ found: true, source: "path" }, false)).toBe(
      "Install managed copy",
    );
  });

  it("labels release and update status while startup checks are running", () => {
    expect(getReleaseStatusLabel(true, null)).toBe("checking release");
    expect(getReleaseStatusLabel(false, "4.2.0")).toBe("latest 4.2.0");
    expect(getReleaseStatusLabel(false, null)).toBe("release unchecked");
    expect(getUpdateStatusLabel(true, false, false, false)).toBe("Checking");
    expect(getUpdateStatusLabel(false, true, true, true)).toBe("Available");
    expect(getUpdateStatusLabel(false, true, false, false)).toBe("Available");
    expect(getUpdateStatusLabel(false, true, false, true)).toBe("Current");
    expect(getUpdateStatusLabel(false, false, false, false)).toBe("Unchecked");
  });

  it("describes where a detected exporter came from", () => {
    expect(describeProbeSource({ found: true, managed: true, source: "managed" })).toBe("Managed");
    expect(describeProbeSource({ found: true, source: "custom" })).toBe("Selected");
    expect(describeProbeSource({ found: true, source: "path" })).toBe("PATH");
    expect(describeProbeSource({ found: true, source: "browser-preview" })).toBe("Preview");
    expect(describeProbeSource({ found: true })).toBe("Exporter");
    expect(isCustomExporterProbe({ found: true, source: "custom" })).toBe(true);
    expect(isCustomExporterProbe({ found: true, source: "path" })).toBe(false);
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

  it("returns stored versions that can be activated for rollback", () => {
    expect(
      getActivatableManagedVersions({
        installRoot: "store",
        activeVersion: "4.2.0",
        installedVersions: ["4.2.0", "4.1.0", "4.0.0"],
      }),
    ).toEqual(["4.1.0", "4.0.0"]);
  });
});
