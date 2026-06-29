import type { FriendlyError } from "./types";

type ErrorRule = {
  pattern: RegExp;
  error: Omit<FriendlyError, "rawDetails">;
};

const rules: ErrorRule[] = [
  {
    pattern: /operation not permitted|full disk access|permission denied/i,
    error: {
      title: "Messages data is blocked by system permissions",
      explanation: "macOS is preventing the exporter from reading protected Messages files.",
      likelyCause: "The terminal, ChatExportMate, or the exporter binary does not have Full Disk Access.",
      suggestedFix: "Grant Full Disk Access to ChatExportMate and the exporter, then run diagnostics again.",
    },
  },
  {
    pattern: /no such file|cannot find|not found|chat\.db/i,
    error: {
      title: "The selected Messages source could not be found",
      explanation: "The exporter could not locate the database or backup path used for this export.",
      likelyCause: "The source path is missing, moved, or points to the wrong file or backup folder.",
      suggestedFix: "Choose the default Messages database or select a valid chat.db file or iOS backup folder.",
    },
  },
  {
    pattern: /encrypted.*backup|password|decrypt|decryption|unlock/i,
    error: {
      title: "Backup could not be unlocked",
      explanation: "The backup password did not work, or the backup could not be unlocked. Re-enter the password and try again.",
      likelyCause: "The selected iPhone backup is encrypted, the password was mistyped, or the backup data could not be decrypted.",
      suggestedFix:
        "Turn on My backup is encrypted, enter the backup password for this export, and run the export again.",
    },
  },
  {
    pattern: /not enough free disk|disk space|insufficient space/i,
    error: {
      title: "Not enough disk space for this export",
      explanation: "The exporter stopped before writing an incomplete export.",
      likelyCause: "The destination drive does not have enough free space for messages and attachments.",
      suggestedFix: "Choose a destination with more space or disable attachment copying for this run.",
    },
  },
  {
    pattern: /imagemagick|ffmpeg|convert/i,
    error: {
      title: "Attachment conversion dependency is missing",
      explanation: "The exporter needs a media conversion tool for the selected attachment copy mode.",
      likelyCause: "ImageMagick or ffmpeg is not installed for this platform or export mode.",
      suggestedFix: "Install the missing media tool or switch the attachment copy method to clone or disabled.",
    },
  },
];

export function translateExporterError(rawDetails: string): FriendlyError {
  const matchingRule = rules.find((rule) => rule.pattern.test(rawDetails));

  if (matchingRule) {
    return {
      ...matchingRule.error,
      rawDetails,
    };
  }

  return {
    title: "The exporter stopped unexpectedly",
    explanation: "ChatExportMate could not match this failure to a known troubleshooting path.",
    likelyCause: "The exporter returned an error that needs review in the raw details.",
    suggestedFix: "Open the log details, check the selected source and destination, then run diagnostics.",
    rawDetails,
  };
}
