# ChatExportMate

ChatExportMate is a local-first Tauri desktop companion for [`ReagentX/imessage-exporter`](https://github.com/ReagentX/imessage-exporter). It does not parse iMessage data itself; it helps users install, configure, run, update, and troubleshoot the upstream exporter through a polished desktop UI.

ChatExportMate is intended only as a desktop app. This repository does not target a hosted web app or a mobile app.

## Status

This repository currently contains the initial Tauri + React + TypeScript application shell, domain modules, test coverage, and a guided desktop UI prototype. Windows development is supported without a local Messages database by using mock diagnostics and dry-run command previews.

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

`pnpm dev` is only a Vite development harness for the Tauri frontend. It is useful for layout checks and dry-run UI work, but it is not a supported web app. Managed installs, selected exporter persistence, exporter detection from app data, opening folders, and process execution require the Tauri desktop runtime.

Native file and folder pickers for export destinations, custom macOS `chat.db`
files, iOS backup folders, attachment roots, and existing `imessage-exporter`
binaries also require the Tauri desktop runtime. In the development harness,
picker buttons report that desktop runtime is required instead of fabricating
local paths.

## Managed Exporter Storage

ChatExportMate manages downloaded `imessage-exporter` binaries under the app data directory exposed by Tauri. The current backend stores binaries in versioned folders and keeps an `active-version.txt` pointer so previous versions remain available for rollback work.

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

ChatExportMate restores the last export options and dry-run mode on startup. In the desktop app, preferences are stored as a local JSON file under the Tauri app data directory. Preferences can include local paths and are not uploaded or synced by ChatExportMate.

## Setup Permissions

The setup panel includes a permission guide for the selected export source and destination. For local macOS Messages exports, grant ChatExportMate Full Disk Access in **System Settings > Privacy & Security > Full Disk Access**, then quit and reopen the app before starting a real export. For iOS exports, choose the local iPhone backup folder that the exporter should read. In both cases, use **Check output access** to verify the export destination before turning dry-run mode off.

The Windows development harness cannot verify Apple privacy permissions; it keeps those checks as review guidance until the app is run on the Mac that contains the Messages database or backup.

Configuration problems are shown both in preflight summaries and next to the form fields that need correction, so users do not need to inspect the generated command to understand what to fix.

When a real export is blocked only because `imessage-exporter` is missing, the Export panel offers **Install exporter** as the primary preflight action. That action uses the managed installer, verifies the downloaded binary, activates it, and returns users to the same guided export flow.

## Export Runs And Logs

When dry-run mode is off, the desktop app executes the selected `imessage-exporter` binary through the Tauri backend. Each export attempt captures:

- command preview
- stdout
- stderr
- exit code
- start and completion timestamps
- output path

Run logs are written under the app data directory in `run-logs/export-run-<timestamp>.log`. The Vite development harness cannot execute exports and will show a desktop-runtime message instead.

The Latest result panel summarizes dry runs, exports, diagnostics, and preflight failures in plain English, with suggested fixes and saved log paths when a run creates a log. After a desktop export, it can open the exported folder and the saved run log directly from the result.

The Progress panel shows the current operation steps while ChatExportMate prepares a dry run, runs an export, runs diagnostics, installs an exporter, or activates a stored managed version. Real exports show setup review, destination access, exporter execution, local log capture, and completion/error state. During desktop export and diagnostics runs, the panel also streams recent stdout/stderr lines from the exporter while preserving the complete output in the saved local log.

The History panel lists saved local export and diagnostic logs when running inside Tauri. Logs stay on the machine and can be opened from the app for troubleshooting or bug reports.

The History panel can also create a local support bundle under the app data directory in `support-bundles/support-bundle-<timestamp>/`. A bundle copies saved run and diagnostic logs and adds a manifest with system/exporter context plus a reminder to review logs before sharing.

## Diagnostics

The diagnostics panel combines app-level checks with upstream exporter diagnostics. App-level checks cover platform, managed binary state, release metadata, command configuration, output-folder write access, and privacy expectations. When a desktop runtime and exporter binary are available, **Run diagnostics** executes `imessage-exporter -d` through Tauri, streams recent process output into the Progress panel, and writes a complete local log under `diagnostic-logs/diagnostic-run-<timestamp>.log`.

Desktop health checks probe the selected output folder, or its existing parent folder when the export folder has not been created yet, by writing and removing a small temporary file. The Vite development harness reports this as a desktop-runtime-only check.

## Verify

```powershell
pnpm test
pnpm build
```

`pnpm build` runs TypeScript checks and creates the Vite production bundle. A full desktop package requires Rust/Cargo through the Tauri CLI.

## Project Principles

- Keep all message data local.
- Do not reimplement `imessage-exporter` parsing behavior.
- Use dynamic GitHub release discovery rather than hardcoded exporter versions.
- Keep command generation, diagnostics, release parsing, and error translation independently testable.
- Treat Windows as the current development platform while isolating platform-specific behavior for future macOS support.

## Attribution And License

ChatExportMate wraps and attributes [`ReagentX/imessage-exporter`](https://github.com/ReagentX/imessage-exporter), which is licensed under GPL-3.0. This project is intended to remain GPL-3.0 compatible.

The app includes an **About / Privacy and license** section that summarizes
the local-first privacy model, upstream attribution, and GPL status for users.
Repository-level attribution lives in [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md),
and the full ChatExportMate license text lives in [LICENSE](LICENSE).
