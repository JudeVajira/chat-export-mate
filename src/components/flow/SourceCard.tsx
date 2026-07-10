import { CheckCircle2, FolderOpen, Pencil, Smartphone } from "lucide-react";
import type { ExportPlatform, IphoneBackupCandidate } from "../../domain/exporter/types";
import { FieldIssues } from "./FieldIssues";
import { compactPath, formatBackupTimestamp } from "./flowFormat";

export function SourceCard({
  backupPassword,
  candidates,
  encryptedBackup,
  fileManagerLabel,
  issues,
  onBackupPasswordChange,
  onEncryptedBackupChange,
  onOpenPicker,
  onOpenSource,
  onUseCandidate,
  passwordIssues,
  platform,
  sourcePath,
  step,
}: {
  backupPassword: string;
  candidates: IphoneBackupCandidate[];
  encryptedBackup: boolean;
  fileManagerLabel: string;
  issues: string[];
  onBackupPasswordChange: (password: string) => void;
  onEncryptedBackupChange: (encrypted: boolean) => void;
  onOpenPicker: () => void;
  onOpenSource: () => void;
  onUseCandidate: (candidate: IphoneBackupCandidate) => void;
  passwordIssues: string[];
  platform: ExportPlatform;
  sourcePath: string;
  step: number;
}) {
  const hasSource = sourcePath.length > 0;
  const isIos = platform === "iOS";
  const newestCandidate = candidates[0] ?? null;
  // An empty source is guidance (the card body and export blockers explain it),
  // not an error; only surface validation problems for a chosen source.
  const visibleIssues = hasSource ? issues : [];

  return (
    <section
      aria-labelledby="source-card-title"
      className={`decision-card ${hasSource ? "is-done" : "is-open"} ${visibleIssues.length > 0 ? "has-issues" : ""}`}
    >
      <header className="decision-card-header">
        <span aria-hidden="true" className="decision-card-step">
          {hasSource ? <CheckCircle2 /> : step}
        </span>
        <div>
          <h2 id="source-card-title">Messages</h2>
          <p>
            {hasSource
              ? isIos
                ? "Reading from this iPhone backup."
                : "Reading from this Messages database."
              : "Where should your messages come from?"}
          </p>
        </div>
        {hasSource ? (
          <div className="decision-card-header-actions">
            <button className="button button--ghost button--compact" onClick={onOpenPicker} type="button">
              <Pencil aria-hidden="true" />
              Change
            </button>
          </div>
        ) : null}
      </header>

      {hasSource ? (
        <div className="decision-card-body">
          <button
            className="path-chip"
            onClick={onOpenSource}
            title={`${fileManagerLabel}: ${sourcePath}`}
            type="button"
          >
            <FolderOpen aria-hidden="true" />
            <code>{compactPath(sourcePath)}</code>
          </button>
          <FieldIssues fieldId="source" issues={visibleIssues} />
        </div>
      ) : (
        <div className="decision-card-body">
          {newestCandidate ? (
            <div className="found-backup">
              <div className="found-backup-copy">
                <strong>iPhone backup found on this computer</strong>
                <span>
                  {newestCandidate.displayName}
                  {newestCandidate.lastModified
                    ? ` · backed up ${formatBackupTimestamp(newestCandidate.lastModified)}`
                    : ""}
                </span>
                <code title={newestCandidate.resolvedPath ?? newestCandidate.path}>
                  {compactPath(newestCandidate.resolvedPath ?? newestCandidate.path)}
                </code>
              </div>
              <div className="found-backup-actions">
                <button
                  className="button button--primary button--compact"
                  onClick={() => onUseCandidate(newestCandidate)}
                  type="button"
                >
                  Use this backup
                </button>
                <button className="button button--ghost button--compact" onClick={onOpenPicker} type="button">
                  Other options
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-source">
              <p>
                {isIos
                  ? "No iPhone backup was found in Apple's usual folders yet. You can create one in a few minutes, or point to a backup you already have."
                  : "Choose the Messages database you want to export from."}
              </p>
              <button className="button button--primary" onClick={onOpenPicker} type="button">
                <Smartphone aria-hidden="true" />
                {isIos ? "Find your messages" : "Choose Messages database"}
              </button>
            </div>
          )}
          <FieldIssues fieldId="source" issues={visibleIssues} />
        </div>
      )}

      {isIos && hasSource ? (
        <div className="decision-card-footer">
          <label className="switch-row">
            <input
              checked={encryptedBackup}
              onChange={(event) => onEncryptedBackupChange(event.currentTarget.checked)}
              type="checkbox"
            />
            <span>
              <strong>This backup is encrypted</strong>
              <small>The password unlocks the backup for this export only. It is never saved.</small>
            </span>
          </label>
          {encryptedBackup ? (
            <div className={`field ${passwordIssues.length > 0 ? "field--error" : ""}`}>
              <label className="field-label" htmlFor="backup-password">
                Backup password
              </label>
              <input
                aria-invalid={passwordIssues.length > 0}
                autoComplete="off"
                id="backup-password"
                onChange={(event) => onBackupPasswordChange(event.currentTarget.value)}
                type="password"
                value={backupPassword}
              />
              <FieldIssues fieldId="backup-password" issues={passwordIssues} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
