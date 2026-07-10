import { ExternalLink, Scale, ShieldCheck, TerminalSquare, X } from "lucide-react";

export function AboutDialog({
  appName,
  onClose,
  spenlioEdition,
}: {
  appName: string;
  onClose: () => void;
  spenlioEdition: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section aria-labelledby="about-title" aria-modal="true" className="dialog about-dialog" role="dialog">
        <header className="dialog-header">
          <div>
            <h2 id="about-title">About {appName}</h2>
            <p>Version {__APP_VERSION__} · privacy, attribution, and license.</p>
          </div>
          <button aria-label="Close about" className="button button--ghost button--icon" onClick={onClose} type="button">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="dialog-body about-body">
          <div className="about-item">
            <ShieldCheck aria-hidden="true" />
            <div>
              <strong>Private by design</strong>
              <p>
                Messages, exports, and logs stay on this device unless you choose to share files
                yourself. There is no account and no cloud.
              </p>
            </div>
          </div>

          <div className="about-item">
            <TerminalSquare aria-hidden="true" />
            <div>
              <strong>{spenlioEdition ? "Built on open tools" : "Powered by imessage-exporter"}</strong>
              <p>
                {spenlioEdition
                  ? `${appName} uses ReagentX's open-source libraries to read local Messages data and handle encrypted backups.`
                  : `${appName} wraps ReagentX/imessage-exporter for exports and diagnostics, and uses its libraries for the finance CSV.`}
              </p>
            </div>
          </div>

          <div className="about-item">
            <Scale aria-hidden="true" />
            <div>
              <strong>Free software</strong>
              <p>
                {appName} is free, open-source software released under the GPL-3.0 license, which
                also describes its warranty terms.
              </p>
            </div>
          </div>

          <div className="about-links">
            <a
              href="https://github.com/JudeVajira/chat-export-mate/issues"
              rel="noreferrer"
              target="_blank"
            >
              Get help / report a problem
              <ExternalLink aria-hidden="true" />
            </a>
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
    </div>
  );
}
