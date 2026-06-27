import { describe, expect, it } from "vitest";
import {
  compareVersions,
  detectRuntimeTarget,
  parseGitHubRelease,
  selectBestAsset,
} from "./release";
import type { GitHubReleaseResponse } from "./types";

const releaseResponse: GitHubReleaseResponse = {
  tag_name: "4.2.0",
  html_url: "https://github.com/ReagentX/imessage-exporter/releases/tag/4.2.0",
  assets: [
    {
      name: "imessage-exporter-aarch64-apple-darwin.tar.gz",
      browser_download_url: "https://example.test/arm.tar.gz",
    },
    {
      name: "imessage-exporter-x86_64-pc-windows-gnu.exe",
      browser_download_url: "https://example.test/windows.exe",
    },
    {
      name: "imessage-exporter-x86_64-pc-windows-gnu.tar.gz",
      browser_download_url: "https://example.test/windows.tar.gz",
    },
  ],
};

describe("release parsing", () => {
  it("selects the direct Windows binary before archive assets", () => {
    const release = parseGitHubRelease(releaseResponse);
    const selected = selectBestAsset(release, { os: "windows", arch: "x64" });

    expect(selected?.asset.name).toBe("imessage-exporter-x86_64-pc-windows-gnu.exe");
    expect(selected?.archive).toBe(false);
  });

  it("normalizes runtime target aliases", () => {
    expect(detectRuntimeTarget({ os: "darwin", arch: "aarch64" })).toEqual({
      os: "macos",
      arch: "arm64",
    });
  });

  it("compares semantic version strings with optional v prefixes", () => {
    expect(compareVersions("v4.1.9", "4.2.0")).toBeLessThan(0);
    expect(compareVersions("4.2", "4.2.0")).toBe(0);
  });
});

