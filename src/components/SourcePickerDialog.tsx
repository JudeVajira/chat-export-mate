import { useState } from "react";
import {
  ExternalLink,
  FolderOpen,
  Laptop,
  RefreshCw,
  Smartphone,
  X,
} from "lucide-react";
import type { IphoneBackupCandidate } from "../domain/exporter/types";
import { compactPath, formatBackupTimestamp } from "./flow/flowFormat";

type SourceTab = "existing" | "create" | "mac";

export function SourcePickerDialog({
  appName,
  backupCandidates,
  loadingBackupCandidates,
  onChooseDetectedIphoneBackup,
  onChooseIphoneBackup,
  onChooseMacDatabase,
  onClose,
  onRefreshBackups,
  showMacSourceChoice,
}: {
  appName: string;
  backupCandidates: IphoneBackupCandidate[];
  loadingBackupCandidates: boolean;
  onChooseDetectedIphoneBackup: (candidate: IphoneBackupCandidate) => void;
  onChooseIphoneBackup: () => void;
  onChooseMacDatabase: () => void;
  onClose: () => void;
  onRefreshBackups: () => void;
  showMacSourceChoice: boolean;
}) {
  const [tab, setTab] = useState<SourceTab>(backupCandidates.length > 0 ? "existing" : "create");

  const tabs: Array<{ id: SourceTab; icon: typeof Smartphone; label: string }> = [
    { id: "existing", icon: FolderOpen, label: "I have a backup" },
    { id: "create", icon: Smartphone, label: "Create a backup" },
    ...(showMacSourceChoice
      ? [{ id: "mac" as const, icon: Laptop, label: "Mac Messages" }]
      : []),
  ];

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="source-picker-title"
        aria-modal="true"
        className="dialog source-picker"
        role="dialog"
      >
        <header className="dialog-header">
          <div>
            <h2 id="source-picker-title">Find your messages</h2>
            <p>Your messages are read from this computer and never uploaded.</p>
          </div>
          <button
            aria-label="Close"
            className="button button--ghost button--icon"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="dialog-tabs" role="tablist">
          {tabs.map((item) => {
            const Icon = item.icon;
            const selected = item.id === tab;
            return (
              <button
                aria-selected={selected}
                className={`dialog-tab ${selected ? "is-selected" : ""}`}
                key={item.id}
                onClick={() => setTab(item.id)}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="dialog-body">
          {tab === "existing" ? (
            <div className="source-tab-content">
              <div className="detected-backups-header">
                <p>
                  {backupCandidates.length > 0
                    ? "These backups were found in Apple's usual folders on this computer."
                    : "No backup was found in Apple's usual folders on this computer."}
                </p>
                <button
                  className="button button--ghost button--compact"
                  disabled={loadingBackupCandidates}
                  onClick={onRefreshBackups}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" className={loadingBackupCandidates ? "spin" : undefined} />
                  {loadingBackupCandidates ? "Scanning…" : "Scan again"}
                </button>
              </div>

              {backupCandidates.length > 0 ? (
                <div className="backup-candidate-list">
                  {backupCandidates.slice(0, 4).map((candidate) => (
                    <div className="backup-candidate" key={candidate.id}>
                      <div className="backup-candidate-main">
                        <strong>{candidate.displayName}</strong>
                        <span>
                          {candidate.lastModified
                            ? `Backed up ${formatBackupTimestamp(candidate.lastModified)}`
                            : candidate.source}
                          {candidate.relocated ? " · moved folder" : ""}
                        </span>
                        <code title={candidate.resolvedPath ?? candidate.path}>
                          {compactPath(candidate.resolvedPath ?? candidate.path)}
                        </code>
                      </div>
                      <button
                        className="button button--primary button--compact"
                        onClick={() => onChooseDetectedIphoneBackup(candidate)}
                        type="button"
                      >
                        Use this backup
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-backup-note">
                  <p>
                    If you have not backed this iPhone up to this computer yet, switch to{" "}
                    <strong>Create a backup</strong>. If your backup lives somewhere unusual, choose
                    its folder manually below.
                  </p>
                </div>
              )}

              <div className="dialog-manual-row">
                <p>Backup stored somewhere else?</p>
                <button className="button button--secondary button--compact" onClick={onChooseIphoneBackup} type="button">
                  <FolderOpen aria-hidden="true" />
                  Choose folder manually
                </button>
              </div>
              <p className="dialog-fineprint">
                Pick the device folder inside Apple&apos;s <code>Backup</code> directory — it contains{" "}
                <code>Manifest.db</code> and many numbered subfolders.
              </p>
            </div>
          ) : null}

          {tab === "create" ? (
            <div className="source-tab-content">
              <ol className="walkthrough-steps">
                <li>
                  <strong>Install Apple Devices from the Microsoft Store.</strong>
                  <span>If you already use iTunes for backups, that works too.</span>
                </li>
                <li>
                  <strong>Connect your iPhone with a USB cable.</strong>
                  <span>Unlock it and tap “Trust This Computer” if asked.</span>
                </li>
                <li>
                  <strong>Back up to this computer.</strong>
                  <span>
                    On the General tab, choose “Back up all of the data on your iPhone to this
                    computer”, then click <em>Back Up Now</em>. Encryption off is simplest; encrypted
                    backups work if you know the password.
                  </span>
                </li>
                <li>
                  <strong>Come back and scan.</strong>
                  <span>
                    When the backup finishes, return to {appName} — it finds backups in Apple&apos;s
                    usual folders automatically.
                  </span>
                </li>
              </ol>
              <div className="dialog-manual-row">
                <a
                  className="button button--ghost button--compact"
                  href="https://support.apple.com/en-us/108967"
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink aria-hidden="true" />
                  Apple&apos;s backup guide
                </a>
                <button
                  className="button button--secondary button--compact"
                  disabled={loadingBackupCandidates}
                  onClick={onRefreshBackups}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" className={loadingBackupCandidates ? "spin" : undefined} />
                  {loadingBackupCandidates ? "Scanning…" : "Scan for my backup"}
                </button>
              </div>
            </div>
          ) : null}

          {tab === "mac" ? (
            <div className="source-tab-content">
              <ol className="walkthrough-steps">
                <li>
                  <strong>Allow local message access.</strong>
                  <span>
                    Open System Settings → Privacy &amp; Security → Full Disk Access, add {appName},
                    and turn it on.
                  </span>
                </li>
                <li>
                  <strong>Quit and reopen {appName}.</strong>
                  <span>macOS applies the permission when the app restarts.</span>
                </li>
                <li>
                  <strong>Choose the Messages database.</strong>
                  <span>
                    The default lives at <code>~/Library/Messages/chat.db</code>.
                  </span>
                </li>
              </ol>
              <div className="dialog-manual-row">
                <button className="button button--primary" onClick={onChooseMacDatabase} type="button">
                  <FolderOpen aria-hidden="true" />
                  Choose Messages database
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
