import type { ExportOptions, ExportPlatform, SystemSnapshot } from "./types";

export function defaultSourcePlatformForHost(snapshot: Pick<SystemSnapshot, "os">): ExportPlatform {
  return isMacHost(snapshot) ? "macOS" : "iOS";
}

export function isMacHost(snapshot: Pick<SystemSnapshot, "os">): boolean {
  const os = snapshot.os.toLowerCase();
  return os === "macos" || os === "darwin";
}

export function shouldShowMacSourceChoice(snapshot: Pick<SystemSnapshot, "os">): boolean {
  return isMacHost(snapshot);
}

export function alignSourcePlatformToHost(
  options: ExportOptions,
  snapshot: Pick<SystemSnapshot, "os">,
): ExportOptions {
  const nextPlatform = defaultSourcePlatformForHost(snapshot);
  if (options.platform === nextPlatform || options.databasePath?.trim()) {
    return options;
  }

  return {
    ...options,
    platform: nextPlatform,
    encryptedBackup: nextPlatform === "iOS" ? options.encryptedBackup : false,
    attachmentRoot: nextPlatform === "iOS" ? "" : options.attachmentRoot,
  };
}
