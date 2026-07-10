import { CheckCircle2, Circle, CircleAlert, LoaderCircle } from "lucide-react";
import type { RunProgress, RunProgressStepState } from "../domain/exporter/runProgress";
import type { ProcessOutputEvent } from "../domain/exporter/types";

const icons: Record<RunProgressStepState, typeof Circle> = {
  active: LoaderCircle,
  completed: CheckCircle2,
  failed: CircleAlert,
  pending: Circle,
};

export function ProgressSteps({
  outputEvents = [],
  progress,
}: {
  outputEvents?: ProcessOutputEvent[];
  progress: RunProgress;
}) {
  return (
    <div className="progress-steps-block">
      <ol className="progress-steps">
        {progress.steps.map((step) => {
          const Icon = icons[step.state];
          return (
            <li className={`progress-step progress-step--${step.state}`} key={step.id}>
              <Icon aria-hidden="true" className={step.state === "active" ? "spin" : undefined} />
              <div>
                <strong>{step.label}</strong>
                {step.state === "active" || step.state === "failed" ? <p>{step.detail}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
      {outputEvents.length > 0 ? (
        <details className="live-output">
          <summary>Show tool output ({outputEvents.length} recent lines)</summary>
          <div className="live-output-list">
            {outputEvents.map((event, index) => (
              <code
                className={`live-output-row live-output-row--${event.stream}`}
                key={`${event.eventId}-${event.timestamp}-${index}`}
              >
                {event.line}
              </code>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
