# ChatExportMate

ChatExportMate is a local-first desktop companion for [`ReagentX/imessage-exporter`](https://github.com/ReagentX/imessage-exporter). It helps users install, configure, run, update, and troubleshoot the upstream exporter through a guided desktop UI. Its Spenlio-compatible CSV mode is an app-owned feature inspired by the upstream project and uses ReagentX libraries to read local Messages database fields safely.

ChatExportMate is intended only as a desktop app. This repository does not target a hosted web app or a mobile app.

## Status

ChatExportMate is currently an experimental alpha project. It is public so the desktop companion can be tested and improved, but it is not stable release software yet.

This repository currently contains the initial Tauri + React + TypeScript application shell, domain modules, test coverage, and a guided desktop UI prototype. Windows development is supported without a local Messages database by using mock diagnostics and testable command-building modules.

## Alpha Downloads

Windows x64 alpha builds are published by GitHub Actions in two forms:

- **Installer**: runs the unsigned `-setup.exe` installer and adds normal Windows install integration.
- **Portable app**: extract the artifact and run `ChatExportMate.exe` without installing. It does not create Start Menu entries, desktop shortcuts, or an uninstaller.

To test the latest build:

1. Open the repository **Actions** tab.
2. Choose the latest **Desktop alpha build** run for the branch you want to test.
3. Download either `ChatExportMate-alpha-windows-x64-installer-<run number>` or `ChatExportMate-alpha-windows-x64-portable-<run number>`.
4. Extract the artifact. For the portable build, also extract the portable ZIP contents into a normal folder before running `ChatExportMate.exe`; do not run the app from inside Windows' ZIP/compressed-folder view.
5. For the installer build, run the `-setup.exe` installer. For the portable build, run `ChatExportMate.exe` from the extracted folder.

These alpha builds are unsigned, experimental, and retained as GitHub Actions artifacts for 14 days. Windows may show an unknown-publisher warning. Review the source and build logs before installing or running a portable build from a public run.

The portable app avoids system installation, but it still stores ChatExportMate app data, managed `imessage-exporter` binaries, preferences, and logs in the normal local app data directory. If ChatExportMate detects that it was launched from a temporary compressed-folder location, it shows an in-app warning to extract the portable ZIP first.

## Prerequisites

- Node.js 24 or newer
- pnpm 11 or newer
- Rust and Cargo for full Tauri desktop development
- Tauri OS prerequisites for your platform: <https://tauri.app/start/prerequisites/>

Rust is required for `pnpm tauri dev` and desktop builds. Frontend build and Vitest checks can run before Rust is installed.

On Windows, install Rust with `rustup` and run full Tauri builds from a Visual Studio Build Tools developer environment so MSVC library paths are available. If a regular shell fails with `cannot open file 'msvcrt.lib'`, start the environment first:

```powershell
cmd /d /s /c '"C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64 && set "PATH=%USERPROFILE%\.cargo\bin;%PATH%" && pnpm tauri build'
```

## Install

```powershell
pnpm install
```

If pnpm blocks `esbuild` build scripts on a fresh machine, approve the pending build once:

```powershell
pnpm approve-builds esbuild
pnpm install
```

## Run

Frontend harness for desktop UI development:

```powershell
pnpm dev
```

Desktop development after Rust/Tauri prerequisites are installed:

```powershell
pnpm tauri dev
```

`pnpm dev` is only a Vite development harness for the desktop frontend. It is useful for layout checks and frontend iteration, but it is not a supported web app. Managed installs, selected exporter persistence, exporter detection from app data, opening folders, and process execution require the desktop app.

Native file and folder pickers for export destinations, custom macOS `chat.db`
files, iOS backup folders, attachment roots, and existing `imessage-exporter`
binaries also require the desktop app. In the development harness,
picker buttons report that the desktop app is required instead of fabricating
local paths.

## Managed Exporter Storage

ChatExportMate manages downloaded `imessage-exporter` binaries under the local app data directory. The current backend stores binaries in versioned folders and keeps an `active-version.txt` pointer so previous versions remain available for rollback work.

Downloaded release assets are cached under `exporter/cache/<version>/` in app data. Reinstalling or updating to a release reuses a cached asset when its file size still matches the GitHub release metadata, then stages and verifies the executable before activation.

On startup, ChatExportMate checks the latest upstream release metadata so the desktop UI can show whether an update is available. This check does not run exports or install binaries by itself.

The managed exporter flow is:

1. Check the latest upstream GitHub release.
2. Select the prebuilt asset for the current OS and architecture.
3. Prefer a direct executable asset, or download and extract the exporter binary from a `.tar.gz` asset when needed.
4. Cache the downloaded release asset locally for future reinstalls or updates.
5. Verify the staged binary can report its version.
6. Store it under the versioned managed exporter directory.
7. Activate the verified managed version.
8. Prefer the managed binary during future exporter detection, then fall back to a verified selected binary and finally `PATH`.

Previously stored managed versions remain available in the Release channel panel and can be reactivated for rollback after the app verifies the stored binary.

Managed install, update, reinstall, and rollback attempts report their outcome in the Latest result panel. Successful installs show the release, selected asset, cache source, binary path, and cache path; failures include a plain-English next step and raw details for troubleshooting.

If you already have `imessage-exporter`, use **Use existing** in Diagnostics. ChatExportMate verifies the selected binary with `--version`, remembers the path locally, and uses it when no managed exporter is active.

## Local Export Preferences

ChatExportMate restores the last export options on startup. In the desktop app, preferences are stored as a local JSON file under the Tauri app data directory. Preferences can include local paths and are not uploaded or synced by ChatExportMate.

## Guided Export Flow

The app is being shaped around a beginner-friendly wizard:

1. Set up the exporter tool automatically.
2. Prepare the message source.
3. Choose the output folder.
4. Pick HTML, Text, or CSV and start the export.

The source guide starts with task-based choices:

- **I need to create a backup**: install or open Apple Devices on Windows, connect the iPhone by USB, trust the computer, choose a local backup to this computer, then use **Back Up Now** and **Manage Backups > Show in Explorer** to find the backup folder. Leaving encryption off is the simplest beginner path, but encrypted backups are supported when you know the backup password.
- **I already created a backup**: let ChatExportMate scan Apple's standard local backup folders, or choose the local iPhone backup folder directly. If that backup needs a password, turn on **My backup is encrypted** before exporting.
- **I am on the Mac with Messages**: shown on macOS, where local Messages data can be exported. Grant ChatExportMate Full Disk Access in **System Settings > Privacy & Security > Full Disk Access**, then quit and reopen the app before choosing `chat.db` or using the default Mac Messages location.

On Windows, ChatExportMate defaults the source flow to **iPhone backup** and does not ask users to choose a Mac Messages source. If saved preferences contain no selected source path, the app aligns the source type to the detected operating system on startup.

For iPhone backups, ChatExportMate checks the standard Apple backup folders for child folders that look like real iOS backups:

- Apple Devices or Microsoft Store iTunes on Windows: `%USERPROFILE%\Apple\MobileSync\Backup`
- Older desktop iTunes on Windows: `%AppData%\Apple Computer\MobileSync\Backup`
- Finder or Apple Devices on macOS: `~/Library/Application Support/MobileSync/Backup`

If a user relocated backups by moving the default `Backup` folder and replacing it with a junction or symlink, ChatExportMate follows the filesystem link and marks the found backup as relocated. If backups were moved without leaving a link at Apple's default location, use **Choose manually** in the source guide.

When choosing manually, select the device-specific folder inside the `Backup` directory, not the parent `Backup` directory itself. The right folder normally contains `Manifest.db`, `Manifest.plist`, `Info.plist`, `Status.plist`, and many numbered subfolders. Treat backup folders as sensitive local data: do not upload them or share their contents when asking for support.

Apple's backup guide is linked from the source guide: <https://support.apple.com/en-us/108967>.

Encrypted iPhone backups are supported through an in-app password prompt. The backup password is used only for the current export, is not saved to preferences, is not written to logs or support bundles, and is not passed as a command-line argument. Finance CSV unlocks the backup inside the desktop backend and loads the decrypted Messages database into an in-memory SQLite connection. HTML, Text, diagnostics, and legacy transcript-line CSV still use `imessage-exporter`; when those modes need the password, ChatExportMate sends it through the helper process stdin prompt instead of using `--cleartext-password`.

In all cases, use **Check access** to verify the export destination before starting.

The Windows development harness cannot verify Apple privacy permissions; it keeps those checks as review guidance until the app is run on the Mac that contains the Messages database or backup.

Configuration problems are shown both in preflight summaries and next to the form fields that need correction, so users do not need to inspect the generated command to understand what to fix.

For export modes that need the external export tool, when an export is blocked only because that tool is missing, the Export panel offers **Install export tool** as the primary preflight action. That action uses the managed installer, verifies the downloaded `imessage-exporter` binary, activates it, and returns users to the same guided export flow.

HTML and Text are passed through to the upstream exporter. CSV is owned by ChatExportMate:

- **One finance CSV**: default Spenlio-compatible output at `spenlio-sms-export.csv` with `sender`, `received_at`, `message_id`, and `message` columns. ChatExportMate reads the local Messages database through ReagentX libraries, uses Apple's `message.guid` when available, falls back to the SQLite message row ID when the GUID is blank, and skips phone-number conversations plus the user's own sent messages.
- **One CSV per sender**: writes `spenlio-sms-export-by-sender/` with one CSV per named business sender using the same four columns and the same Apple-backed message IDs.
- **Transcript lines**: legacy row-per-line output at `chatexportmate-transcript-lines.csv` with `transcript_file`, `line_number`, and `text` columns. This layout runs the upstream text export first and converts the generated text transcripts locally.

The finance CSV layouts do not require the external `imessage-exporter` executable to be installed, because the desktop app reads the selected local Messages source directly through bundled ReagentX libraries. HTML, Text, diagnostics, and legacy transcript-line CSV still use the upstream executable.

For encrypted backup finance CSV, the decrypted Messages database is not written to a temp file. It is streamed into an in-memory SQLite connection for the current export and released when the run finishes.

Only the legacy transcript-line conversion uses generated row-style IDs, because plain text transcripts do not reliably carry the database message identifier.

## Export Runs And Logs

When the user starts an export, the desktop app either runs the selected `imessage-exporter` binary through the desktop backend or uses the built-in structured CSV reader for finance CSV. Each export attempt captures local troubleshooting details:

- command details
- stdout
- stderr
- exit code
- start and completion timestamps
- output path

Run details are written under the app data directory in `run-logs/export-run-<timestamp>.log`. The Vite development harness cannot execute exports and will show a desktop-app-required message instead.

The export result panel summarizes exports, diagnostics, setup actions, and preflight failures in plain English, with suggested fixes. After a desktop export, it can open the exported folder directly. Log files are kept for the Support page and error troubleshooting instead of being front-and-center in the happy path.

The Progress panel shows the current operation steps while ChatExportMate runs an export, runs diagnostics, sets up an exporter, or activates a stored managed version. Exports show setup review, destination access, exporter execution, local log capture, and completion/error state. During desktop export and diagnostics runs, the panel also streams recent stdout/stderr lines from the exporter while preserving the complete output in the saved local log.

The Support page lists saved local export and diagnostic logs when running inside the desktop app. Logs stay on the machine and can be searched by file, path, command, output folder, status, or exit code, then previewed or opened from the app for troubleshooting. Large log previews are capped in the UI; open the log file or create a support bundle when you need the complete file.

The Support page can also create a local support bundle under the app data directory in `support-bundles/support-bundle-<timestamp>/`. A bundle copies saved run and diagnostic logs and adds a manifest with system/exporter context plus a reminder to review logs before sharing.

## Diagnostics

The Diagnostics page combines app-level checks with upstream exporter diagnostics. App-level checks cover platform, exporter detection, executable launch access, managed binary state, release metadata, command configuration, output-folder write access, and privacy expectations. When the desktop app and exporter binary are available, **Run diagnostics** executes `imessage-exporter -d`, streams recent process output into the Progress panel, and writes complete local troubleshooting details under `diagnostic-logs/diagnostic-run-<timestamp>.log`.

Desktop health checks probe the selected output folder, or its existing parent folder when the export folder has not been created yet, by writing and removing a small temporary file. The Vite development harness reports this as a desktop-runtime-only check.

## Verify

```powershell
pnpm test
pnpm build
```

`pnpm build` runs TypeScript checks and creates the Vite production bundle. A full desktop package requires Rust/Cargo through the Tauri CLI.

Rust tests can be run with:

```powershell
cargo test --manifest-path src-tauri\Cargo.toml
```

There is also an ignored local-only smoke test for a real iPhone backup. It writes sensitive CSV output, so only run it with a backup you own and an output folder outside the repository:

```powershell
$env:CHAT_EXPORT_MATE_REAL_BACKUP_PATH = "path\to\device-backup-folder"
$env:CHAT_EXPORT_MATE_REAL_OUTPUT_PATH = "path\outside\the\repo"
cargo test --manifest-path src-tauri\Cargo.toml local_iphone_backup_structured_csv_smoke_export -- --ignored
```

## Project Principles

- Keep all message data local.
- Do not reimplement general `imessage-exporter` behavior. Keep app-owned format work narrow, local-first, and covered by focused tests.
- Use dynamic GitHub release discovery rather than hardcoded exporter versions.
- Keep command generation, diagnostics, release parsing, and error translation independently testable.
- Treat Windows as the current development platform while isolating platform-specific behavior for future macOS support.

## Attribution And License

ChatExportMate wraps and attributes [`ReagentX/imessage-exporter`](https://github.com/ReagentX/imessage-exporter), which is licensed under GPL-3.0. The Spenlio-compatible CSV path also uses ReagentX's GPL-3.0-or-later Rust libraries for Messages database access and encrypted backup handling. This project is intended to remain GPL-3.0 compatible.

The app includes an **About / Privacy and license** section that summarizes
the local-first privacy model, upstream attribution, and GPL status for users.
Repository-level attribution lives in [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md),
and the full ChatExportMate license text lives in [LICENSE](LICENSE).
