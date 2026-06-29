import type { DiagnosticItem } from "./types";

export type ExportPreflightState = "ready" | "warning" | "blocked";

export interface ExportPreflightSummary {
  state: ExportPreflightState;
  title: string;
  detail: string;
  actionLabel: string;
  canRunExport: boolean;
  blockingReasons: string[];
  nonBlockingNotes: string[];
  recommendedAction: ExportPreflightAction | null;
}

export interface ExportPreflightAction {
  id: "install-exporter";
  label: string;
  detail: string;
}

const baseBlockingCheckIds = new Set(["configuration", "output-access"]);

export function buildExportPreflightSummary(
  diagnostics: DiagnosticItem[],
  dryRun: boolean,
  exporterRequired = true,
): ExportPreflightSummary {
  const exporterReady = diagnostics.some((item) => item.id === "exporter" && item.state === "passed");
  const blockingCheckIds = exporterRequired
    ? new Set([...baseBlockingCheckIds, "exporter"])
    : baseBlockingCheckIds;
  const blockingReasons = diagnostics
    .filter((item) => blockingCheckIds.has(item.id) && item.state !== "passed")
    .map(formatDiagnosticReason);

  const nonBlockingNotes = diagnostics
    .filter(
      (item) =>
        item.state === "warning" &&
        !blockingCheckIds.has(item.id) &&
        (item.id !== "executable-access" || exporterReady),
    )
    .map(formatDiagnosticReason);

  const canRunExport = blockingReasons.length === 0;
  const recommendedAction = exporterRequired ? findRecommendedAction(diagnostics) : null;

  if (canRunExport) {
    return {
      state: "ready",
      title: dryRun ? "Ready to check command" : "Ready to export messages",
      detail: dryRun
        ? "Developer command checks build exporter arguments without writing export files."
        : exporterRequired
          ? "The export tool, message source, and export location are ready."
          : "The message source and export location are ready.",
      actionLabel: dryRun ? "Check command" : "Start export",
      canRunExport,
      blockingReasons,
      nonBlockingNotes,
      recommendedAction: null,
    };
  }

  if (dryRun) {
    return {
      state: "warning",
      title: "Command check available, export not ready",
      detail: "Developer command checks can still build arguments, but a real export needs the items below.",
      actionLabel: "Check command",
      canRunExport,
      blockingReasons,
      nonBlockingNotes,
      recommendedAction,
    };
  }

  return {
    state: "blocked",
    title: "Finish setup before exporting",
    detail: "Complete the items below, then ChatExportMate can save your messages.",
    actionLabel: "Finish setup",
    canRunExport,
    blockingReasons,
    nonBlockingNotes,
    recommendedAction,
  };
}

function formatDiagnosticReason(item: DiagnosticItem): string {
  if (item.id === "exporter") {
    return item.state === "passed"
      ? "The export tool is ready."
      : "Install the export tool so ChatExportMate can read your local backup.";
  }

  if (item.id === "configuration") {
    return item.detail;
  }

  if (item.id === "output-access") {
    return item.state === "passed"
      ? "The export location is ready."
      : "Choose where ChatExportMate should save your exported messages.";
  }

  if (item.id === "executable-access") {
    return item.state === "passed"
      ? "The export tool can run."
      : "Install the export tool before ChatExportMate checks it.";
  }

  if (item.id === "release") {
    return item.detail;
  }

  return item.detail;
}

function findRecommendedAction(diagnostics: DiagnosticItem[]): ExportPreflightAction | null {
  const exporter = diagnostics.find((item) => item.id === "exporter");
  const asset = diagnostics.find((item) => item.id === "asset");

  if (exporter?.state !== "passed" && asset?.state === "passed") {
    return {
      id: "install-exporter",
      label: "Install export tool",
      detail: "ChatExportMate will download and verify the local tool it uses to read your backup.",
    };
  }

  return null;
}
