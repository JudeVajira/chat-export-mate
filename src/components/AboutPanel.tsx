import { ExternalLink, Scale, ShieldCheck, TerminalSquare } from "lucide-react";

export function AboutPanel() {
  return (
    <section className="panel about-panel" aria-labelledby="about-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">About</p>
          <h2 id="about-title">Privacy and license</h2>
        </div>
      </div>

      <div className="about-body">
        <div className="about-grid">
          <article className="about-item">
            <ShieldCheck aria-hidden="true" />
            <h3>Local-first data</h3>
            <p>
              Messages, exports, logs, and support bundles stay on this device unless the user
              chooses to share files manually.
            </p>
          </article>

          <article className="about-item">
            <TerminalSquare aria-hidden="true" />
            <h3>Exporter companion</h3>
            <p>
              ChatExportMate wraps ReagentX/imessage-exporter for discovery, setup, execution,
              diagnostics, logs, and updates. Finance CSV support uses ReagentX libraries for local
              database fields.
            </p>
          </article>

          <article className="about-item">
            <Scale aria-hidden="true" />
            <h3>Free software</h3>
            <p>
              ChatExportMate is GPL-3.0-or-later software and comes without warranty. Upstream
              attribution is kept in the repository acknowledgements.
            </p>
          </article>
        </div>

        <div className="about-links" aria-label="Project links">
          <a href="https://github.com/ReagentX/imessage-exporter" rel="noreferrer" target="_blank">
            Upstream exporter
            <ExternalLink aria-hidden="true" />
          </a>
          <a href="https://www.gnu.org/licenses/gpl-3.0.html" rel="noreferrer" target="_blank">
            GPL-3.0 license
            <ExternalLink aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
