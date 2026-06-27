import { CheckCircle2, Circle, CircleAlert, LoaderCircle } from "lucide-react";
import type { RunProgress, RunProgressStepState } from "../domain/exporter/runProgress";
import type { ProcessOutputEvent } from "../domain/exporter/types";

const icons: Record<RunProgressStepState, typeof Circle> = {
  active: LoaderCircle,
  completed: CheckCircle2,
  failed: CircleAlert,
  pending: Circle,
};

export function RunProgressPanel({
  outputEvents = [],
  progress,
}: {
  outputEvents?: ProcessOutputEvent[];
  progress: RunProgress | null;
}) {
  return (
    <section className="panel progress-panel" aria-labelledby="run-progress-title">
      <div className="section-heading section-heading--progress">
        <div>
          <p className="section-kicker">Progress</p>
          <h2 id="run-progress-title">{progress?.title ?? "Run monitor"}</h2>
        </div>
        {progress ? (
          <span className={`progress-state progress-state--${progress.state}`}>
            {progress.state === "active"
              ? "Running"
              : progress.state === "failed"
                ? "Needs attention"
                : "Complete"}
          </span>
        ) : null}
      </div>

      {progress ? (
        <div className="progress-body">
          <p className="progress-detail">{progress.detail}</p>
          <ol className="progress-steps">
            {progress.steps.map((step) => {
              const Icon = icons[step.state];
              return (
                <li className={`progress-step progress-step--${step.state}`} key={step.id}>
                  <Icon aria-hidden="true" />
                  <div>
                    <strong>{step.label}</strong>
                    <p>{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          {outputEvents.length > 0 ? (
            <div className="live-output" aria-label="Live process output">
              <div className="live-output-heading">
                <h3>Live output</h3>
                <span>
                  {outputEvents.length} recent line{outputEvents.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="live-output-list">
                {outputEvents.map((event, index) => (
                  <div
                    className={`live-output-row live-output-row--${event.stream}`}
                    key={`${event.eventId}-${event.timestamp}-${index}`}
                  >
                    <span>{event.stream}</span>
                    <code>{event.line}</code>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="empty-state">
          Start a dry run, export, diagnostics check, or managed exporter operation to see the current steps.
        </p>
      )}
    </section>
  );
}
