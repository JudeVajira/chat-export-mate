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

- Keep domain logic in TypeScript modules that can be tested without Tauri.
- Keep Tauri commands small and focused on platform capabilities: filesystem, process execution, OS inspection, and opening paths.
- Use interfaces/adapters for exporter binaries, GitHub release lookups, command execution, logging, and diagnostics.
- Use fake exporter responses and dry-run data so Windows development can continue without a Messages database or iPhone backup.
- Treat platform-specific behavior as an adapter boundary rather than a condition spread across UI components.
- Native file and folder selection flows go through the Tauri dialog plugin via `src/services/tauriBridge.ts`; browser preview should report desktop-runtime-only behavior rather than inventing local paths.

# Managed Exporter

- Managed downloads live under Tauri app data in an `exporter/versions/<version>/` layout.
- `active-version.txt` points to the currently selected managed binary; keep older version folders for future rollback support.
- Managed installs and rollback activation should probe the candidate binary successfully before writing `active-version.txt`.
- Exporter detection should prefer the active managed binary and fall back to `PATH`.
- Prefer direct executable release assets over `.tar.gz` archives. If only an archive is available, fail with a clear managed-install error until extraction support is added.
- Browser preview may use mock/fallback state, but Tauri desktop runtime owns filesystem writes and managed installs.

# Export Execution And Logs

- Non-dry-run exports execute through the Tauri backend using `std::process::Command`.
- Every backend export attempt should write a local log under app data `run-logs/`, including command, stdout, stderr, exit code, timestamps, and output path.
- The History UI lists persisted app-data export and diagnostic logs through a Tauri command and opens selected log files locally; browser preview should show an empty stored-log list rather than fake desktop files.
- Support bundles should be created locally under app data `support-bundles/`, copy saved logs, include a short manifest, and remind users to review logs before sharing them.
- The UI should translate failed exporter output through the error translation domain module rather than showing raw stderr as the primary message.
- Browser preview must not pretend to execute exports; it should return a clear desktop-runtime-only message.

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
