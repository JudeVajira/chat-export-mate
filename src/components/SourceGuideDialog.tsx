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
    detail: "Create a local backup first, then choose that backup folder.",
    icon: Smartphone,
  },
  {
    id: "iphone-backup",
    title: "I already made a backup",
    detail: "Choose the local iPhone backup folder on this computer.",
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
}: SourceGuideDialogProps) {
  const [choice, setChoice] = useState<SourceGuideChoice>("iphone-new");
  const selectedChoice = sourceGuideChoices.find((item) => item.id === choice) ?? sourceGuideChoices[0];
  const SelectedIcon = selectedChoice.icon;

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
              ChatExportMate needs a local Messages source before it can export. If you only have
              an iPhone, make a local computer backup first.
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
          {sourceGuideChoices.map((item) => {
            const Icon = item.icon;
            const isSelected = item.id === choice;
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
          <div className="source-guide-intro">
            <SelectedIcon aria-hidden="true" />
            <div>
              <h3>{selectedChoice.title}</h3>
              <p>{selectedChoice.detail}</p>
            </div>
          </div>

          {choice === "iphone-new" ? <IphoneBackupWalkthrough /> : null}
          {choice === "iphone-backup" ? <ExistingBackupHelp /> : null}
          {choice === "mac-messages" ? <MacMessagesHelp /> : null}
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
            onClick={choice === "mac-messages" ? onChooseMacDatabase : onChooseIphoneBackup}
            type="button"
          >
            <FolderOpen aria-hidden="true" />
            {choice === "mac-messages" ? "Choose chat.db" : "Choose backup folder"}
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
          <strong>Install Apple Devices on Windows.</strong>
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
          <strong>Open the iPhone in Apple Devices.</strong>
          <span>Select the iPhone in the sidebar, then open the General page.</span>
        </li>
        <li>
          <strong>Create a local backup.</strong>
          <span>
            Choose the option to back up all iPhone data to this computer. Turn on encrypted backup
            if you need Apple to include protected local data.
          </span>
        </li>
        <li>
          <strong>Click Back Up Now and wait for it to finish.</strong>
          <span>Keep the iPhone connected until Apple Devices says the backup completed.</span>
        </li>
        <li>
          <strong>Find the backup folder.</strong>
          <span>
            Use Manage Backups, choose the newest backup, and select Show in Explorer. Then come
            back here and choose that folder.
          </span>
        </li>
      </ol>
      <div className="source-guide-note">
        ChatExportMate does not copy anything from your iPhone directly. It reads the local backup
        folder you choose and keeps exports on this computer.
      </div>
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
        in Explorer.
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
