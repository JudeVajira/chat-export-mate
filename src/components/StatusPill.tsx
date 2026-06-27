import type { DiagnosticState } from "../domain/exporter/types";

const labels: Record<DiagnosticState, string> = {
  passed: "Ready",
  warning: "Review",
  action: "Action",
};

export function StatusPill({ state, label }: { state: DiagnosticState; label?: string }) {
  return <span className={`status-pill status-pill--${state}`}>{label ?? labels[state]}</span>;
}

