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

const exportBlockingCheckIds = new Set(["exporter", "configuration", "output-access"]);

export function buildExportPreflightSummary(
  diagnostics: DiagnosticItem[],
  dryRun: boolean,
): ExportPreflightSummary {
  const blockingReasons = diagnostics
    .filter((item) => exportBlockingCheckIds.has(item.id) && item.state !== "passed")
    .map(formatDiagnosticReason);

  const nonBlockingNotes = diagnostics
    .filter((item) => item.state === "warning" && !exportBlockingCheckIds.has(item.id))
    .map(formatDiagnosticReason);

  const canRunExport = blockingReasons.length === 0;
  const recommendedAction = findRecommendedAction(diagnostics);

  if (canRunExport) {
    return {
      state: "ready",
      title: dryRun ? "Ready for command preview" : "Ready to export",
      detail: dryRun
        ? "Dry run will build the exporter command without writing export files."
        : "ChatExportMate has an exporter, valid options, and a writable output location.",
      actionLabel: dryRun ? "Start dry run" : "Start export",
      canRunExport,
      blockingReasons,
      nonBlockingNotes,
      recommendedAction: null,
    };
  }

  if (dryRun) {
    return {
      state: "warning",
      title: "Preview available, export not ready",
      detail: "Dry run can still show the command, but a real export needs the items below.",
      actionLabel: "Start dry run",
      canRunExport,
      blockingReasons,
      nonBlockingNotes,
      recommendedAction,
    };
  }

  return {
    state: "blocked",
    title: "Export needs attention",
    detail: "Resolve the preflight items below before starting the exporter.",
    actionLabel: "Resolve preflight",
    canRunExport,
    blockingReasons,
    nonBlockingNotes,
    recommendedAction,
  };
}

function formatDiagnosticReason(item: DiagnosticItem): string {
  return `${item.label}: ${item.detail}`;
}

function findRecommendedAction(diagnostics: DiagnosticItem[]): ExportPreflightAction | null {
  const exporter = diagnostics.find((item) => item.id === "exporter");
  const asset = diagnostics.find((item) => item.id === "asset");

  if (exporter?.state !== "passed" && asset?.state === "passed") {
    return {
      id: "install-exporter",
      label: "Install exporter",
      detail: "ChatExportMate can download, verify, and activate the managed imessage-exporter binary before you export.",
    };
  }

  return null;
}
