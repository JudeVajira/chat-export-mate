import type {
  ExporterRelease,
  GitHubReleaseResponse,
  RuntimeTarget,
  SelectedReleaseAsset,
} from "./types";

export const latestReleaseUrl =
  "https://api.github.com/repos/ReagentX/imessage-exporter/releases/latest";

const targetTriples: Record<RuntimeTarget["os"], Partial<Record<RuntimeTarget["arch"], string>>> = {
  windows: {
    x64: "x86_64-pc-windows-gnu",
  },
  macos: {
    arm64: "aarch64-apple-darwin",
    x64: "x86_64-apple-darwin",
  },
  linux: {},
  unknown: {},
};

export function parseGitHubRelease(response: GitHubReleaseResponse): ExporterRelease {
  return {
    version: normalizeVersion(response.tag_name),
    releaseUrl: response.html_url,
    publishedAt: response.published_at,
    assets: response.assets ?? [],
  };
}

export async function fetchLatestExporterRelease(
  fetcher: typeof fetch = fetch,
): Promise<ExporterRelease> {
  const response = await fetcher(latestReleaseUrl, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub release lookup failed with HTTP ${response.status}`);
  }

  return parseGitHubRelease((await response.json()) as GitHubReleaseResponse);
}

export function selectBestAsset(
  release: ExporterRelease,
  target: RuntimeTarget,
): SelectedReleaseAsset | null {
  const targetTriple = targetTriples[target.os]?.[target.arch];
  if (!targetTriple) {
    return null;
  }

  const matchingAssets = release.assets.filter((asset) => asset.name.includes(targetTriple));
  if (matchingAssets.length === 0) {
    return null;
  }

  const directBinary = matchingAssets.find((asset) => !isArchiveAsset(asset.name));
  const asset = directBinary ?? matchingAssets[0];

  return {
    asset,
    targetTriple,
    archive: isArchiveAsset(asset.name),
  };
}

export function isArchiveAsset(assetName: string): boolean {
  return assetName.endsWith(".tar.gz");
}

export function detectRuntimeTarget(snapshot: { os: string; arch: string }): RuntimeTarget {
  return {
    os: normalizeOs(snapshot.os),
    arch: normalizeArch(snapshot.arch),
  };
}

export function isUpdateAvailable(
  installedVersion: string | null | undefined,
  latestVersion: string,
): boolean {
  if (!installedVersion) {
    return false;
  }

  return compareVersions(installedVersion, latestVersion) < 0;
}

export function compareVersions(left: string, right: string): number {
  const leftParts = normalizeVersion(left).split(".").map(Number);
  const rightParts = normalizeVersion(right).split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }

  return 0;
}

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/u, "");
}

function normalizeOs(os: string): RuntimeTarget["os"] {
  const normalized = os.toLowerCase();
  if (normalized.includes("windows") || normalized === "win32") {
    return "windows";
  }
  if (normalized.includes("darwin") || normalized.includes("macos")) {
    return "macos";
  }
  if (normalized.includes("linux")) {
    return "linux";
  }
  return "unknown";
}

function normalizeArch(arch: string): RuntimeTarget["arch"] {
  const normalized = arch.toLowerCase();
  if (normalized === "x86_64" || normalized === "x64" || normalized === "amd64") {
    return "x64";
  }
  if (normalized === "aarch64" || normalized === "arm64") {
    return "arm64";
  }
  return "unknown";
}
