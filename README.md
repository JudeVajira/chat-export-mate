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

On startup, ChatExportMate checks the latest upstream release metadata so the desktop UI can show whether an update is available. This check does not run exports or install binaries by itself.

The managed exporter flow is:

1. Check the latest upstream GitHub release.
2. Select the prebuilt asset for the current OS and architecture.
3. Prefer a direct executable asset, or download and extract the exporter binary from a `.tar.gz` asset when needed.
4. Verify the downloaded binary can report its version.
5. Store it under the versioned managed exporter directory.
6. Activate the verified managed version.
7. Prefer the managed binary during future exporter detection, then fall back to a verified selected binary and finally `PATH`.

Previously stored managed versions remain available in the Release channel panel and can be reactivated for rollback after the app verifies the stored binary.

If you already have `imessage-exporter`, use **Use existing** in Diagnostics. ChatExportMate verifies the selected binary with `--version`, remembers the path locally, and uses it when no managed exporter is active.

## Local Export Preferences

ChatExportMate restores the last export options and dry-run mode on startup. In the desktop app, preferences are stored as a local JSON file under the Tauri app data directory. Preferences can include local paths and are not uploaded or synced by ChatExportMate.

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

The History panel lists saved local export and diagnostic logs when running inside Tauri. Logs stay on the machine and can be opened from the app for troubleshooting or bug reports.

The History panel can also create a local support bundle under the app data directory in `support-bundles/support-bundle-<timestamp>/`. A bundle copies saved run and diagnostic logs and adds a manifest with system/exporter context plus a reminder to review logs before sharing.

## Diagnostics

The diagnostics panel combines app-level checks with upstream exporter diagnostics. App-level checks cover platform, managed binary state, release metadata, command configuration, output-folder write access, and privacy expectations. When a desktop runtime and exporter binary are available, **Run diagnostics** executes `imessage-exporter -d` through Tauri and writes a local log under `diagnostic-logs/diagnostic-run-<timestamp>.log`.

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
