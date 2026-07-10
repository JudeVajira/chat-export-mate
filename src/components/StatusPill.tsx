import type { DiagnosticState } from "../domain/exporter/types";

const labels: Record<DiagnosticState, string> = {
  passed: "Ready",
  warning: "Check",
  action: "Needs setup",
};

export function StatusPill({ state, label }: { state: DiagnosticState; label?: string }) {
  return <span className={`status-pill status-pill--${state}`}>{label ?? labels[state]}</span>;
}

