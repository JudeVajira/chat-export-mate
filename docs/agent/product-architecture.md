---
type: topic
title: Product Architecture
description: Durable product, architecture, privacy, and testing constraints for ChatExportMate.
scope: repo-wide
status: active
tags: [tauri, react, imessage-exporter, architecture, privacy]
sources:
  - pasted project brief, 2026-06-27
related:
  - ../../AGENTS.md
  - ./research.md
---

# Product Boundary

ChatExportMate is a desktop companion for `ReagentX/imessage-exporter`, not a replacement parser. The app owns discovery, download/update, configuration, command construction, execution, log presentation, diagnostics, and user-friendly error translation. The upstream exporter owns message parsing.

# Architecture

- This is a desktop-only Tauri app. Do not add web-app or mobile-app product surfaces, routes, packaging, or user-facing support language.
- Vite/browser rendering is a developer harness for the Tauri frontend only. Keep it useful for layout and domain checks, but never treat it as a supported runtime.
- Development-harness fallbacks may return mock or empty state, but should not persist user paths or app preferences in browser storage.
- Keep domain logic in TypeScript modules that can be tested without Tauri.
- Keep Tauri commands small and focused on platform capabilities: filesystem, process execution, OS inspection, and opening paths.
- Use interfaces/adapters for exporter binaries, GitHub release lookups, command execution, logging, and diagnostics.
- Use fake exporter responses and dry-run data so Windows development can continue without a Messages database or iPhone backup.
- Treat platform-specific behavior as an adapter boundary rather than a condition spread across UI components.
- Native file and folder selection flows go through the Tauri dialog plugin via `src/services/tauriBridge.ts`; the development browser harness should report desktop-runtime-only behavior rather than inventing local paths.
- Source selection is platform-specific: macOS custom sources use a `chat.db` file picker, while iOS custom sources use a backup-folder picker. Attachment roots are macOS-only and should not be emitted for iOS commands.
- Existing exporter binary selection also goes through `src/services/tauriBridge.ts`; the backend must verify the selected binary with `--version` before saving it.

# Managed Exporter

- Managed downloads live under Tauri app data in an `exporter/versions/<version>/` layout.
- Downloaded release assets are cached under Tauri app data `exporter/cache/<version>/` and should be reused only when the cached file still matches known release metadata such as asset size.
- `active-version.txt` points to the currently selected managed binary; keep older version folders for future rollback support.
- Managed installs and rollback activation should probe the candidate binary successfully before writing `active-version.txt`.
- Exporter detection should prefer the active managed binary, then a verified user-selected binary saved in app data, then `PATH`.
- Startup health checks should fetch latest release metadata so the UI can show update availability without a manual **Check release** click. This check is metadata-only and must not install, run exports, or run upstream diagnostics by itself.
- Prefer direct executable release assets over `.tar.gz` archives, but managed installs should extract the expected exporter binary from `.tar.gz` assets when a direct binary is not available.
- The Tauri desktop runtime owns filesystem writes, managed installs, and durable user settings. Development-harness fallback state must not become a supported web-app behavior.

# Export Execution And Logs

- Export options and dry-run mode should be restored from local desktop app data on startup and saved back after changes. The Tauri runtime owns the app-data JSON file.
- Non-dry-run exports execute through the Tauri backend using `std::process::Command`.
- Every backend export attempt should write a local log under app data `run-logs/`, including command, stdout, stderr, exit code, timestamps, and output path.
- The History UI lists persisted app-data export and diagnostic logs through a Tauri command and opens selected log files locally; the development browser harness should show an empty stored-log list rather than fake desktop files.
- Support bundles should be created locally under app data `support-bundles/`, copy saved logs, include a short manifest, and remind users to review logs before sharing them.
- The UI should translate failed exporter output through the error translation domain module rather than showing raw stderr as the primary message.
- Real export readiness should be derived from the tested preflight summary domain module; keep dry-run command preview available while explaining blockers for an actual export.
- Latest export and diagnostic results should show a structured explanation, likely cause, suggested fix, saved log path when available, and optional raw details; keep the activity log concise.
- Latest export results should expose desktop actions to open the exported output folder and saved log when those paths are available. Diagnostic results should expose the saved log action when available.
- The development browser harness must not pretend to execute exports; it should return a clear desktop-runtime-only message.

# Diagnostics

- App-level health checks refresh platform, managed store, release, configuration, and privacy state.
- Desktop health checks should verify output write access locally by creating/removing a temporary file in the selected output folder or its existing parent when the target folder is not created yet.
- Upstream diagnostics execute `imessage-exporter -d` through Tauri only when an exporter binary is available.
- Diagnostic attempts write local app data logs under `diagnostic-logs/` and should be summarized through testable domain helpers.
- Startup should refresh health checks only; it should not run upstream diagnostics until the user clicks **Run diagnostics**.

# Privacy

- Do not upload messages, exports, logs containing message content, or user-selected paths by default.
- Do not require accounts or cloud services.
- Do not add analytics by default.
- Logs should be useful for bug reports but should keep raw details inspectable and exportable under user control.
- Saved export preferences are local state and may include user-selected paths; do not sync or upload them by default.

# Licensing And Attribution

- Keep user-facing privacy and license text visible in the app, currently through the About panel.
- Keep `ACKNOWLEDGEMENTS.md`, `README.md`, and the About panel aligned when attribution, license, warranty, or upstream wrapper language changes.
- ChatExportMate is GPL-3.0-or-later and wraps `ReagentX/imessage-exporter`, which is GPL-3.0 licensed. Do not describe ChatExportMate as the parser or as an official upstream app.

# Testing Focus

Prioritize tests for:

- command generation from export options
- output/source validation
- GitHub release parsing and asset selection
- installed version comparison
- error translation from known stderr patterns
- diagnostics result aggregation
- managed install/update UI state and action labels

# UX Notes

- The first screen should be a usable desktop app workspace with setup, export configuration, diagnostics, logs, and command preview.
- Translate technical failures into a plain-English explanation, likely cause, suggested fix, and optional raw details.
- Show command preview as a transparency feature without making users understand every flag.
