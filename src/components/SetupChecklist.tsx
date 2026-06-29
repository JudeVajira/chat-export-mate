import { CheckCircle2, CircleAlert, CircleDot, ExternalLink } from "lucide-react";
import type { PermissionGuide } from "../domain/exporter/permissions";
import type { DiagnosticItem } from "../domain/exporter/types";
import { StatusPill } from "./StatusPill";

const icons = {
  passed: CheckCircle2,
  warning: CircleAlert,
  action: CircleDot,
};

export function SetupChecklist({
  items,
  permissions,
}: {
  items: DiagnosticItem[];
  permissions: PermissionGuide;
}) {
  const setupItems = [...items, ...permissions.items];
  const setupState = setupItems.some((item) => item.state === "action")
    ? "action"
    : setupItems.some((item) => item.state === "warning")
      ? "warning"
      : "passed";
  const setupLabel = setupState === "action" ? "Needs setup" : setupState === "warning" ? "Review" : "Ready";

  return (
    <section className="panel setup-panel" aria-labelledby="setup-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Setup</p>
          <h2 id="setup-title">Export readiness</h2>
        </div>
        <StatusPill
          label={setupLabel}
          state={setupState}
        />
      </div>

      <div className="checklist">
        {items.map((item) => {
          const Icon = icons[item.state];
          return (
            <div className="checklist-row" key={item.id}>
              <Icon aria-hidden="true" className={`checklist-icon checklist-icon--${item.state}`} />
              <div>
                <div className="checklist-label">{item.label}</div>
                <p>{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="permission-guide" aria-label="Permission guide">
        <div className="permission-guide-heading">
          <h3>Permissions</h3>
          <p>{permissions.intro}</p>
        </div>
        <div className="permission-list">
          {permissions.items.map((item) => {
            const Icon = icons[item.state];
            return (
              <article className="permission-row" key={item.id}>
                <div className="permission-row-heading">
                  <Icon aria-hidden="true" className={`checklist-icon checklist-icon--${item.state}`} />
                  <div>
                    <h4>{item.label}</h4>
                    <p>{item.detail}</p>
                  </div>
                  <StatusPill state={item.state} />
                </div>
                <ol className="permission-steps">
                  {item.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {item.reference ? (
                  <a className="permission-reference" href={item.reference.url} rel="noreferrer" target="_blank">
                    {item.reference.label}
                    <ExternalLink aria-hidden="true" />
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
