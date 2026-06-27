export type ExportFormat = "html" | "txt";

export type ExportPlatform = "macOS" | "iOS";

export type AttachmentCopyMethod = "disabled" | "clone" | "basic" | "full";

export type DiagnosticState = "passed" | "warning" | "action";

export interface ExportOptions {
  format: ExportFormat;
  platform: ExportPlatform;
  outputPath: string;
  databasePath?: string;
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

export interface BuiltCommand {
  executablePath: string;
  args: string[];
  displayCommand: string;
}

export interface ExportRunRequest extends BuiltCommand {
  outputPath: string;
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
}

export interface DiagnosticRunRequest extends BuiltCommand {}

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

export interface ValidationIssue {
  field: keyof ExportOptions | "executablePath";
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

export interface ManagedExporterState {
  installRoot: string;
  activePath?: string | null;
  activeVersion?: string | null;
  installedVersions: string[];
  error?: string | null;
}

export interface ManagedInstallResult {
  release: ExporterRelease;
  assetName: string;
  binaryPath: string;
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
