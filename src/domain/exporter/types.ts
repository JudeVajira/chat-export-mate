export type ExportFormat = "html" | "txt" | "csv";

export type ExportPlatform = "macOS" | "iOS";

export type AttachmentCopyMethod = "disabled" | "clone" | "basic" | "full";

export type DiagnosticState = "passed" | "warning" | "action";

export interface ExportOptions {
  format: ExportFormat;
  platform: ExportPlatform;
  outputPath: string;
  databasePath?: string;
  encryptedBackup: boolean;
  attachmentRoot?: string;
  copyMethod: AttachmentCopyMethod;
  startDate?: string;
  endDate?: string;
  conversationFilter?: string;
  customName?: string;
  useCallerId: boolean;
  noLazyImages: boolean;
  ignoreDiskWarning: boolean;
  noProgress: boolean;
}

export interface ExportPreferences {
  schemaVersion: 1;
  options: ExportOptions;
  dryRun: boolean;
  savedAt: string;
}

export interface BuiltCommand {
  executablePath: string;
  args: string[];
  displayCommand: string;
  requestedFormat: ExportFormat;
  exporterFormat: "html" | "txt";
}

export interface ExportRuntimeSecrets {
  backupPassword?: string;
}

export interface ExportRunRequest extends BuiltCommand {
  eventId?: string;
  outputPath: string;
  backupPassword?: string;
}

export interface ExportRunResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode?: number | null;
  success: boolean;
  startedAt: string;
  completedAt: string;
  logPath: string;
  outputPath: string;
  csvPath?: string | null;
}

export interface OutputAccessCheck {
  path: string;
  resolvedPath: string;
  writable: boolean;
  checkedAt: string;
  detail: string;
  error?: string | null;
}

export interface DiagnosticRunRequest extends BuiltCommand {
  eventId?: string;
}

export interface DiagnosticRunResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode?: number | null;
  success: boolean;
  startedAt: string;
  completedAt: string;
  logPath: string;
}

export type ProcessOutputKind = "export" | "diagnostic";

export type ProcessOutputStream = "stdout" | "stderr";

export interface ProcessOutputEvent {
  eventId: string;
  kind: ProcessOutputKind;
  stream: ProcessOutputStream;
  line: string;
  timestamp: string;
}

export type StoredLogKind = "export" | "diagnostic";

export interface StoredLogEntry {
  id: string;
  kind: StoredLogKind;
  fileName: string;
  path: string;
  command?: string | null;
  success?: boolean | null;
  exitCode?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  outputPath?: string | null;
}

export interface StoredLogDetail {
  entry: StoredLogEntry;
  content: string;
  size: number;
  truncated: boolean;
}

export interface SupportBundleResult {
  bundlePath: string;
  manifestPath: string;
  logCount: number;
  createdAt: string;
}

export interface IphoneBackupCandidate {
  id: string;
  path: string;
  resolvedPath?: string | null;
  rootPath: string;
  source: string;
  displayName: string;
  lastModified?: number | null;
  relocated: boolean;
}

export type ValidationIssueField = keyof ExportOptions | "executablePath" | "backupPassword";

export interface ValidationIssue {
  field: ValidationIssueField;
  message: string;
}

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

export interface GitHubReleaseResponse {
  tag_name: string;
  html_url: string;
  published_at?: string;
  assets: ReleaseAsset[];
}

export interface ExporterRelease {
  version: string;
  releaseUrl: string;
  publishedAt?: string;
  assets: ReleaseAsset[];
}

export interface RuntimeTarget {
  os: "windows" | "macos" | "linux" | "unknown";
  arch: "x64" | "arm64" | "unknown";
}

export interface SelectedReleaseAsset {
  asset: ReleaseAsset;
  targetTriple: string;
  archive: boolean;
}

export interface SystemSnapshot {
  os: string;
  arch: string;
  family: string;
  default_exporter_name: string;
  executable_path?: string | null;
  launch_warning?: string | null;
}

export interface ExporterProbe {
  found: boolean;
  path?: string | null;
  version?: string | null;
  raw_version_output?: string | null;
  error?: string | null;
  managed?: boolean;
  source?: string;
}

export interface CachedReleaseAsset {
  id: string;
  version: string;
  fileName: string;
  path: string;
  size: number;
}

export interface ManagedExporterState {
  installRoot: string;
  activePath?: string | null;
  activeVersion?: string | null;
  installedVersions: string[];
  cachedAssets?: CachedReleaseAsset[];
  error?: string | null;
}

export interface ManagedInstallResult {
  release: ExporterRelease;
  assetName: string;
  binaryPath: string;
  cachePath: string;
  cacheStatus: "downloaded" | "reused";
  probe: ExporterProbe;
  state: ManagedExporterState;
}

export interface ManagedActivationResult {
  probe: ExporterProbe;
  state: ManagedExporterState;
}

export interface DiagnosticItem {
  id: string;
  label: string;
  detail: string;
  state: DiagnosticState;
}

export interface FriendlyError {
  title: string;
  explanation: string;
  likelyCause: string;
  suggestedFix: string;
  rawDetails?: string;
}
