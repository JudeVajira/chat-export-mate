import { normalizeLocalPathForDisplay } from "../../domain/exporter/paths";

export function compactPath(path: string): string {
  const displayPath = normalizeLocalPathForDisplay(path);
  const normalizedPath = displayPath.replace(/\\/gu, "/");
  const parts = normalizedPath.split("/").filter(Boolean);
  if (parts.length <= 4) {
    return displayPath;
  }

  return `${parts.slice(0, 2).join("/")}/…/${parts.slice(-2).join("/")}`;
}

export function pathBasename(path: string): string {
  const normalizedPath = normalizeLocalPathForDisplay(path).replace(/\\/gu, "/");
  const parts = normalizedPath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? normalizedPath;
}

export function formatBackupTimestamp(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
