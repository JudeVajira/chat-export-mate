import type {
  DiagnosticState,
  ExportOptions,
  OutputAccessCheck,
  SystemSnapshot,
} from "./types";

export interface PermissionGuideItem {
  id: string;
  label: string;
  detail: string;
  state: DiagnosticState;
  steps: string[];
  reference?: {
    label: string;
    url: string;
  };
}

export interface PermissionGuide {
  intro: string;
  items: PermissionGuideItem[];
}

const APPLE_FULL_DISK_ACCESS_URL =
  "https://support.apple.com/guide/mac-help/change-privacy-security-settings-on-mac-mchl211c911f/mac";

export function buildPermissionGuide(
  snapshot: SystemSnapshot,
  options: ExportOptions,
  outputAccess?: OutputAccessCheck,
): PermissionGuide {
  return {
    intro:
      "ChatExportMate only uses permissions to read a local source and write the export on this computer.",
    items: [
      buildSourcePermissionItem(snapshot, options),
      buildDestinationPermissionItem(outputAccess),
      {
        id: "local-only",
        label: "Local privacy",
        detail: "Exports, paths, preferences, and logs stay on this device unless you choose to share them.",
        state: "passed",
        steps: [
          "No account or cloud sync is required.",
          "Review saved logs before sharing them with a maintainer.",
        ],
      },
    ],
  };
}

function buildSourcePermissionItem(
  snapshot: SystemSnapshot,
  options: ExportOptions,
): PermissionGuideItem {
  if (options.platform === "iOS") {
    const hasBackupFolder = Boolean(options.databasePath?.trim());
    return {
      id: "ios-backup-access",
      label: "iPhone backup access",
      detail: hasBackupFolder
        ? "A local iPhone backup folder is selected for the export source."
        : "Choose the local iPhone backup folder that imessage-exporter should read.",
      state: hasBackupFolder ? "passed" : "action",
      steps: [
        "Create or locate a local iPhone backup on the Mac that will run the export.",
        "Choose the backup folder in ChatExportMate.",
        "Keep the backup on local disk until the export finishes.",
      ],
    };
  }

  const runningOnMac = isMacSnapshot(snapshot);
  return {
    id: "macos-full-disk-access",
    label: "Messages database access",
    detail: runningOnMac
      ? "Grant Full Disk Access before reading the local Messages database."
      : "Review this on the Mac that contains the Messages database; Windows development cannot verify it.",
    state: runningOnMac ? "action" : "warning",
    steps: [
      "Open System Settings > Privacy & Security > Full Disk Access.",
      "Add ChatExportMate and turn it on.",
      "Quit and reopen ChatExportMate before starting a real export.",
      "If macOS asks about an exporter helper, allow the prompt.",
    ],
    reference: {
      label: "Apple Full Disk Access settings",
      url: APPLE_FULL_DISK_ACCESS_URL,
    },
  };
}

function buildDestinationPermissionItem(outputAccess?: OutputAccessCheck): PermissionGuideItem {
  if (outputAccess?.writable) {
    return {
      id: "destination-access",
      label: "Export destination",
      detail: outputAccess.detail,
      state: "passed",
      steps: ["The selected output folder passed the desktop write-access check."],
    };
  }

  return {
    id: "destination-access",
    label: "Export destination",
    detail: outputAccess?.detail ?? "Choose an output folder and verify write access before exporting.",
    state: outputAccess?.error ? "action" : "warning",
    steps: [
      "Choose a folder you control, such as a Documents or Desktop export folder.",
      "Use Check output access before starting a real export.",
      "If the folder is protected, grant access or choose a different destination.",
    ],
  };
}

function isMacSnapshot(snapshot: SystemSnapshot): boolean {
  const os = snapshot.os.toLowerCase();
  const family = snapshot.family.toLowerCase();

  return os.includes("mac") || family.includes("mac") || family.includes("darwin");
}
