# ChatExportMate

ChatExportMate is a local-first Tauri desktop companion for [`ReagentX/imessage-exporter`](https://github.com/ReagentX/imessage-exporter). It does not parse iMessage data itself; it helps users install, configure, run, update, and troubleshoot the upstream exporter through a polished desktop UI.

## Status

This repository currently contains the initial Tauri + React + TypeScript application shell, domain modules, test coverage, and a guided desktop UI prototype. Windows development is supported without a local Messages database by using mock diagnostics and dry-run command previews.

## Prerequisites

- Node.js 24 or newer
- pnpm 11 or newer
- Rust and Cargo for full Tauri desktop development
- Tauri OS prerequisites for your platform: <https://tauri.app/start/prerequisites/>

Rust is required for `pnpm tauri dev` and desktop builds. Frontend build and Vitest checks can run before Rust is installed.

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

Frontend-only development:

```powershell
pnpm dev
```

Desktop development after Rust/Tauri prerequisites are installed:

```powershell
pnpm tauri dev
```

The browser preview can check the GitHub release feed and exercise dry-run UI state. Managed installs, exporter detection from app data, and process execution require the Tauri desktop runtime.

## Managed Exporter Storage

ChatExportMate manages downloaded `imessage-exporter` binaries under the app data directory exposed by Tauri. The current backend stores binaries in versioned folders and keeps an `active-version.txt` pointer so previous versions remain available for rollback work.

The managed exporter flow is:

1. Check the latest upstream GitHub release.
2. Select the prebuilt asset for the current OS and architecture.
3. Download the direct executable asset.
4. Store it under the versioned managed exporter directory.
5. Prefer the managed binary during future exporter detection, then fall back to `PATH`.

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
