import { CheckCircle2, CircleAlert, CircleDot } from "lucide-react";
import type { DiagnosticItem } from "../domain/exporter/types";
import { StatusPill } from "./StatusPill";

const icons = {
  passed: CheckCircle2,
  warning: CircleAlert,
  action: CircleDot,
};

export function SetupChecklist({ items }: { items: DiagnosticItem[] }) {
  return (
    <section className="panel setup-panel" aria-labelledby="setup-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Setup</p>
          <h2 id="setup-title">Export readiness</h2>
        </div>
        <StatusPill
          label={items.some((item) => item.state === "action") ? "Needs setup" : "Ready"}
          state={items.some((item) => item.state === "action") ? "action" : "passed"}
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
    </section>
  );
}

