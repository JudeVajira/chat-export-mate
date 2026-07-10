const windowsExtendedPrefix = "\\\\?\\";
const windowsNtPrefix = "\\??\\";
const windowsExtendedUncPrefix = "\\\\?\\UNC\\";
const slashExtendedPrefix = "//?/";
const slashExtendedUncPrefix = "//?/UNC/";

export function normalizeLocalPathForDisplay(path: string): string {
  if (path.startsWith(windowsExtendedUncPrefix)) {
    return `\\\\${path.slice(windowsExtendedUncPrefix.length)}`;
  }

  if (path.startsWith(windowsExtendedPrefix)) {
    return path.slice(windowsExtendedPrefix.length);
  }

  if (path.startsWith(windowsNtPrefix)) {
    return path.slice(windowsNtPrefix.length);
  }

  if (path.startsWith(slashExtendedUncPrefix)) {
    return `//${path.slice(slashExtendedUncPrefix.length)}`;
  }

  if (path.startsWith(slashExtendedPrefix)) {
    return path.slice(slashExtendedPrefix.length);
  }

  return path;
}

export function normalizeLocalPathTextForDisplay(text: string): string {
  return replaceAllText(
    replaceAllText(
      replaceAllText(
        replaceAllText(
          replaceAllText(text, windowsExtendedUncPrefix, "\\\\"),
          windowsExtendedPrefix,
          "",
        ),
        windowsNtPrefix,
        "",
      ),
      slashExtendedUncPrefix,
      "//",
    ),
    slashExtendedPrefix,
    "",
  );
}

export function normalizeOptionalLocalPathForDisplay(path: string | null | undefined): string {
  return path ? normalizeLocalPathForDisplay(path) : "";
}

function replaceAllText(value: string, search: string, replacement: string): string {
  return value.split(search).join(replacement);
}
