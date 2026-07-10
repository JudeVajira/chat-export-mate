import { useEffect, useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  FolderOpen,
  Laptop,
  RefreshCw,
  Smartphone,
  X,
} from "lucide-react";
import type { IphoneBackupCandidate } from "../domain/exporter/types";
import { normalizeLocalPathForDisplay } from "../domain/exporter/paths";

type SourceGuideChoice = "iphone-new" | "iphone-backup" | "mac-messages";

interface SourceGuideDialogProps {
  appName?: string;
  backupCandidates: IphoneBackupCandidate[];
  encryptedBackup: boolean;
  loadingBackupCandidates: boolean;
  onChooseDetectedIphoneBackup: (candidate: IphoneBackupCandidate) => void;
  onChooseIphoneBackup: () => void;
  onChooseMacDatabase: () => void;
  onClose: () => void;
  onEncryptedBackupChange: (encryptedBackup: boolean) => void;
  onRefreshBackups: () => void;
  sourceSelected: boolean;
  showMacSourceChoice: boolean;
}

const sourceGuideChoices: Array<{
  id: SourceGuideChoice;
  title: string;
  detail: string;
  icon: typeof Smartphone;
}> = [
  {
    id: "iphone-new",
    title: "I need to create a backup",
    detail: "Create one on this computer.",
    icon: Smartphone,
  },
  {
    id: "iphone-backup",
    title: "I already created a backup",
    detail: "Use a backup saved here.",
    icon: FolderOpen,
  },
  {
    id: "mac-messages",
    title: "I am on the Mac with Messages",
    detail: "Choose the Mac Messages database after Full Disk Access is allowed.",
    icon: Laptop,
  },
];

export function SourceGuideDialog({
  appName = "ChatExportMate",
  backupCandidates,
  encryptedBackup,
  loadingBackupCandidates,
  onChooseDetectedIphoneBackup,
  onChooseIphoneBackup,
  onChooseMacDatabase,
  onClose,
  onEncryptedBackupChange,
  onRefreshBackups,
  sourceSelected,
  showMacSourceChoice,
}: SourceGuideDialogProps) {
  const initialChoice = showMacSourceChoice
    ? "mac-messages"
    : sourceSelected || backupCandidates.length > 0
      ? "iphone-backup"
      : "iphone-new";
  const [choice, setChoice] = useState<SourceGuideChoice>(initialChoice);
  const userSelectedChoice = useRef(false);
  const visibleChoices = sourceGuideChoices.filter(
    (item) => showMacSourceChoice || item.id !== "mac-messages",
  );
  const safeChoice = visibleChoices.some((item) => item.id === choice) ? choice : "iphone-new";

  useEffect(() => {
    if (!showMacSourceChoice && (sourceSelected || backupCandidates.length > 0) && !userSelectedChoice.current) {
      setChoice("iphone-backup");
    }
  }, [backupCandidates.length, showMacSourceChoice, sourceSelected]);

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
        aria-describedby="source-guide-description"
        aria-labelledby="source-guide-title"
        aria-modal="true"
        className="source-guide-dialog"
        role="dialog"
      >
        <header className="source-guide-header">
          <div>
            <p className="section-kicker">
              {showMacSourceChoice ? "Message source" : "Find your iPhone backup"}
            </p>
            <h2 id="source-guide-title">
              {showMacSourceChoice ? "Start with what you have" : "Find your iPhone backup"}
            </h2>
            <p id="source-guide-description">
              {showMacSourceChoice
                ? `Choose the local Messages data you want ${appName} to export.`
                : "Your messages are read from a backup on this computer and are not uploaded."}
            </p>
          </div>
          <button
            aria-label="Close source guide"
            className="button button--icon button--secondary"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="source-choice-list" role="radiogroup" aria-label="Choose your source path">
          {visibleChoices.map((item) => {
            const Icon = item.icon;
            const isSelected = item.id === safeChoice;
            return (
              <button
                aria-checked={isSelected}
                className={`source-choice ${isSelected ? "is-selected" : ""}`}
                key={item.id}
                onClick={() => {
                  userSelectedChoice.current = true;
                  setChoice(item.id);
                }}
                role="radio"
                type="button"
              >
                <Icon aria-hidden="true" />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
                {isSelected ? <Check aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>

        <div className="source-guide-body">
          {safeChoice === "iphone-new" ? <IphoneBackupWalkthrough appName={appName} /> : null}
          {safeChoice === "iphone-backup" ? (
            <ExistingBackupHelp
              appName={appName}
              backupCandidates={backupCandidates}
              loadingBackupCandidates={loadingBackupCandidates}
              onChooseDetectedIphoneBackup={onChooseDetectedIphoneBackup}
              onRefreshBackups={onRefreshBackups}
            />
          ) : null}
          {safeChoice === "mac-messages" ? <MacMessagesHelp appName={appName} /> : null}
        </div>

        {safeChoice !== "mac-messages" ? (
          <EncryptedBackupChoice
            encryptedBackup={encryptedBackup}
            onEncryptedBackupChange={onEncryptedBackupChange}
          />
        ) : null}

        <footer className="source-guide-actions">
          <a
            className="button button--secondary"
            href="https://support.apple.com/en-us/108967"
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" />
            Apple backup guide
          </a>
          {safeChoice === "iphone-backup" && backupCandidates.length === 0 ? (
            <button className="button button--primary" onClick={() => setChoice("iphone-new")} type="button">
              <Smartphone aria-hidden="true" />
              Show backup steps
            </button>
          ) : null}
          <button
            className={`button ${
              safeChoice === "iphone-backup" && backupCandidates.length === 0
                ? "button--secondary"
                : "button--primary"
            }`}
            onClick={safeChoice === "mac-messages" ? onChooseMacDatabase : onChooseIphoneBackup}
            type="button"
          >
            <FolderOpen aria-hidden="true" />
            {safeChoice === "mac-messages"
              ? "Choose Mac Messages database"
              : safeChoice === "iphone-backup" && backupCandidates.length === 0
                ? "Choose folder manually"
                : "Choose backup folder"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function IphoneBackupWalkthrough({ appName }: { appName: string }) {
  return (
    <div className="source-guide-content">
      <ol className="source-guide-steps">
        <li>
          <strong>Open Apple Devices on Windows.</strong>
          <span>
            Open Microsoft Store, search for Apple Devices by Apple, and install it. If you already
            use iTunes for device backups, you can use that instead.
          </span>
        </li>
        <li>
          <strong>Connect the iPhone with a USB cable.</strong>
          <span>Unlock the iPhone and tap Trust This Computer if the phone asks.</span>
        </li>
        <li>
          <strong>On General, create a local computer backup.</strong>
          <span>
            Choose the option to back up all iPhone data to this computer. Leaving encryption off
            is the simplest path; encrypted backups work too if you know the backup password.
          </span>
        </li>
        <li>
          <strong>If the backup is encrypted, keep the password ready.</strong>
          <span>
            Turn on My backup is encrypted in {appName} before exporting. The password is used
            only for that export and is not saved.
          </span>
        </li>
        <li>
          <strong>Back up, then reveal the folder.</strong>
          <span>
            Click Back Up Now and wait. Then use Manage Backups, choose the newest backup, select
            Show in Explorer, and choose that folder here.
          </span>
        </li>
      </ol>
    </div>
  );
}

function ExistingBackupHelp({
  appName,
  backupCandidates,
  loadingBackupCandidates,
  onChooseDetectedIphoneBackup,
  onRefreshBackups,
}: {
  appName: string;
  backupCandidates: IphoneBackupCandidate[];
  loadingBackupCandidates: boolean;
  onChooseDetectedIphoneBackup: (candidate: IphoneBackupCandidate) => void;
  onRefreshBackups: () => void;
}) {
  return (
    <div className="source-guide-content">
      <section className="detected-backups" aria-label="Detected iPhone backups">
        <div className="detected-backups-header">
          <div>
            <h3>
              {backupCandidates.length > 0
                ? "Backups found on this computer"
                : "No standard backup folder found yet"}
            </h3>
            <p>
              {backupCandidates.length > 0
                ? `${appName} checks the standard places Apple uses on this computer. Choose one here instead of browsing for a folder.`
                : `${appName} checked the standard places Apple uses on this computer. If your backup is somewhere else, choose it manually.`}
            </p>
          </div>
          <button
            className="button button--secondary button--compact"
            disabled={loadingBackupCandidates}
            onClick={onRefreshBackups}
            type="button"
          >
            <RefreshCw aria-hidden="true" className={loadingBackupCandidates ? "spin" : undefined} />
            {loadingBackupCandidates ? "Scanning" : "Scan again"}
          </button>
        </div>

        {backupCandidates.length > 0 ? (
          <div className="backup-candidate-list">
            {backupCandidates.slice(0, 4).map((candidate, index) => (
              <article className="backup-candidate" key={candidate.id}>
                <div className="backup-candidate-main">
                  <strong>{index === 0 ? "Newest backup found" : candidate.displayName}</strong>
                  <span>
                    {candidate.source}
                    {candidate.relocated ? " · relocated default folder" : ""}
                    {candidate.lastModified ? ` · ${formatBackupDate(candidate.lastModified)}` : ""}
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
              </article>
            ))}
          </div>
        ) : (
          <div className="no-backup-guide">
            <strong>{appName} could not find a completed iPhone backup on this computer.</strong>
            <p>
              We checked Apple&apos;s standard backup folders on this computer. Finish a local backup
              first, then come back and click Scan again.
            </p>
            <ol>
              <li>Open Apple Devices or iTunes.</li>
              <li>Create a local backup to this computer.</li>
              <li>Return to {appName} and click Scan again.</li>
            </ol>
          </div>
        )}
      </section>

      <p className="source-guide-plain">
        If you already know where the backup folder is, choose it manually. If you are not sure,
        open Apple Devices, use Manage Backups, pick the newest backup, and choose Show in
        Explorer. If the backup needs a password, turn on My backup is encrypted before exporting.
      </p>
      <details className="source-guide-advanced">
        <summary>Moved your backup folder?</summary>
        <p>
          If the original Apple backup folder was replaced with a junction or symlink, {appName}
          should still find it. If the folder was moved without a link at Apple&apos;s normal location,
          choose the backup folder manually.
        </p>
      </details>
    </div>
  );
}

function MacMessagesHelp({ appName }: { appName: string }) {
  return (
    <div className="source-guide-content">
      <ol className="source-guide-steps">
        <li>
          <strong>Use the Mac that has the Messages app data.</strong>
          <span>
            On a Mac, the default database is usually in your home folder at
            Library/Messages/chat.db.
          </span>
        </li>
        <li>
          <strong>Allow local message access.</strong>
          <span>
            Open System Settings, go to Privacy &amp; Security, then Full Disk Access. Add
            {appName} and turn it on.
          </span>
        </li>
        <li>
          <strong>Quit and reopen {appName}.</strong>
          <span>
            Then choose chat.db if you want to use a custom source instead of the default Mac
            Messages location.
          </span>
        </li>
      </ol>
    </div>
  );
}

function EncryptedBackupChoice({
  encryptedBackup,
  onEncryptedBackupChange,
}: {
  encryptedBackup: boolean;
  onEncryptedBackupChange: (encryptedBackup: boolean) => void;
}) {
  return (
    <label className={`source-encrypted-choice ${encryptedBackup ? "is-selected" : ""}`}>
      <input
        checked={encryptedBackup}
        onChange={(event) => onEncryptedBackupChange(event.currentTarget.checked)}
        type="checkbox"
      />
      <span>
        <strong>My backup is encrypted</strong>
        <small>
          Encrypted backups need the backup password. The password is used only for this export and
          is not saved.
        </small>
      </span>
    </label>
  );
}

function formatBackupDate(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function compactPath(path: string): string {
  const displayPath = normalizeLocalPathForDisplay(path);
  const normalizedPath = displayPath.replace(/\\/gu, "/");
  const parts = normalizedPath.split("/").filter(Boolean);
  if (parts.length <= 4) {
    return displayPath;
  }

  return `${parts.slice(0, 2).join("/")}/.../${parts.slice(-2).join("/")}`;
}
