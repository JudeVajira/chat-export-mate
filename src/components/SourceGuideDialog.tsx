import { useState } from "react";
import {
  Check,
  ExternalLink,
  FolderOpen,
  Laptop,
  Smartphone,
  X,
} from "lucide-react";

type SourceGuideChoice = "iphone-new" | "iphone-backup" | "mac-messages";

interface SourceGuideDialogProps {
  onChooseIphoneBackup: () => void;
  onChooseMacDatabase: () => void;
  onClose: () => void;
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
    title: "I only have an iPhone",
    detail: "Create a backup on this computer, then choose it.",
    icon: Smartphone,
  },
  {
    id: "iphone-backup",
    title: "I already made a backup",
    detail: "Choose the iPhone backup folder already saved here.",
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
  onChooseIphoneBackup,
  onChooseMacDatabase,
  onClose,
  showMacSourceChoice,
}: SourceGuideDialogProps) {
  const initialChoice = showMacSourceChoice ? "mac-messages" : "iphone-new";
  const [choice, setChoice] = useState<SourceGuideChoice>(initialChoice);
  const visibleChoices = sourceGuideChoices.filter(
    (item) => showMacSourceChoice || item.id !== "mac-messages",
  );
  const safeChoice = visibleChoices.some((item) => item.id === choice) ? choice : "iphone-new";
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
            <p className="section-kicker">Message source</p>
            <h2 id="source-guide-title">Start with what you have</h2>
            <p id="source-guide-description">
              {showMacSourceChoice
                ? "Choose the local Messages data you want ChatExportMate to export."
                : "ChatExportMate exports from a local iPhone backup on this computer. Your messages are not uploaded."}
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

        <div className="source-choice-list" role="tablist" aria-label="Choose your source path">
          {visibleChoices.map((item) => {
            const Icon = item.icon;
            const isSelected = item.id === safeChoice;
            return (
              <button
                aria-selected={isSelected}
                className={`source-choice ${isSelected ? "is-selected" : ""}`}
                key={item.id}
                onClick={() => setChoice(item.id)}
                role="tab"
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
          {safeChoice === "iphone-new" ? <IphoneBackupWalkthrough /> : null}
          {safeChoice === "iphone-backup" ? <ExistingBackupHelp /> : null}
          {safeChoice === "mac-messages" ? <MacMessagesHelp /> : null}
        </div>

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
          <button
            className="button button--primary"
            onClick={safeChoice === "mac-messages" ? onChooseMacDatabase : onChooseIphoneBackup}
            type="button"
          >
            <FolderOpen aria-hidden="true" />
            {safeChoice === "mac-messages" ? "Choose Mac Messages database" : "Choose backup folder"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function IphoneBackupWalkthrough() {
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
            Choose the option to back up all iPhone data to this computer. For this alpha, keep
            the backup unencrypted so ChatExportMate can export it without asking for a password.
          </span>
        </li>
        <li>
          <strong>If Apple asks about encryption, choose Don&apos;t Encrypt.</strong>
          <span>
            Encrypted backups need a password. ChatExportMate does not support backup password
            prompts in the app yet. The backup stays on this computer.
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

function ExistingBackupHelp() {
  return (
    <div className="source-guide-content">
      <p className="source-guide-plain">
        Choose the folder for the local iPhone backup you want to export. It is usually a long
        folder name inside Apple&apos;s MobileSync Backup location. If you are not sure which folder
        is correct, open Apple Devices, use Manage Backups, pick the newest backup, and choose Show
        in Explorer. If the backup is encrypted, make a new unencrypted local backup for this alpha
        version.
      </p>
    </div>
  );
}

function MacMessagesHelp() {
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
            ChatExportMate and turn it on.
          </span>
        </li>
        <li>
          <strong>Quit and reopen ChatExportMate.</strong>
          <span>
            Then choose chat.db if you want to use a custom source instead of the default Mac
            Messages location.
          </span>
        </li>
      </ol>
    </div>
  );
}
