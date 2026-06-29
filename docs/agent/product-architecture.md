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

ChatExportMate is a desktop companion for `ReagentX/imessage-exporter`, not a replacement general exporter. The app owns discovery, download/update, configuration, command construction, execution, log presentation, diagnostics, user-friendly error translation, and narrow app-owned CSV layouts. The upstream exporter owns HTML/Text export behavior and remains the default parsing/exporting authority.

# Architecture

- This is a desktop-only Tauri app. Do not add web-app or mobile-app product surfaces, routes, packaging, or user-facing support language.
- Vite/browser rendering is a developer harness for the Tauri frontend only. Keep it useful for layout and domain checks, but never treat it as a supported runtime.
- Development-harness fallbacks may return mock or empty state, but should not persist user paths or app preferences in browser storage.
- Keep domain logic in TypeScript modules that can be tested without Tauri.
- Keep Tauri commands small and focused on platform capabilities: filesystem, process execution, OS inspection, and opening paths.
- Use interfaces/adapters for exporter binaries, GitHub release lookups, command execution, logging, and diagnostics.
- Use fake exporter responses and testable command-generation modules so Windows development can continue without a Messages database or iPhone backup.
- Treat platform-specific behavior as an adapter boundary rather than a condition spread across UI components.
- Native file and folder selection flows go through the Tauri dialog plugin via `src/services/tauriBridge.ts`; the development browser harness should report desktop-runtime-only behavior rather than inventing local paths.
- Source selection is platform-specific: macOS custom sources use a `chat.db` file picker, while iOS custom sources use a backup-folder picker. Attachment roots are macOS-only and should not be emitted for iOS commands.
- Beginner source selection is guide-first, not picker-first. Users who only have an iPhone must be guided through creating and locating a local Apple Devices/iTunes backup before the app asks them to choose a folder; raw `chat.db` and backup folder pickers belong behind "already have it" paths.
- Source defaults should follow the detected host OS. On Windows, default and empty saved source settings should align to iPhone backup and hide Mac `chat.db` choices from the primary flow; on macOS, the Mac Messages path can be offered.
- iPhone backup discovery should stay conservative: scan Apple's documented MobileSync backup roots for the current OS, require normal iOS backup marker files in child folders, and follow filesystem links at the default `Backup` folder so junction/symlink relocations still work. Do not scan arbitrary drives or parse message contents during discovery.
- Encrypted iPhone backup support must use a volatile in-app password prompt. Never use upstream `--cleartext-password` in the normal app flow, and never persist, log, display, preview, or include backup passwords in preferences, support bundles, process args, command previews, or telemetry. For upstream executable modes, send the current-run password through process stdin. For app-owned finance CSV, unlock the backup in the Tauri backend and stream the decrypted Messages database into an in-memory SQLite connection; do not write a decrypted temp database file.
- Keep Tauri `security.csp` enabled for packaged builds. If local development needs extra Vite/HMR allowances, use `devCsp` rather than setting the production CSP back to `null`.
- Existing exporter binary selection also goes through `src/services/tauriBridge.ts`; the backend must verify the selected binary with `--version` before saving it.
- Keep framework/runtime names such as Tauri out of normal user-facing app copy. Use plain phrases such as "desktop app"; keep implementation terminology in developer docs, diagnostics internals, or code.

# Managed Exporter

- Managed downloads live under Tauri app data in an `exporter/versions/<version>/` layout.
- Downloaded release assets are cached under Tauri app data `exporter/cache/<version>/` and should be reused only when the cached file still matches known release metadata such as asset size.
- `active-version.txt` points to the currently selected managed binary; keep older version folders for future rollback support.
- Managed installs and rollback activation should probe the candidate binary successfully before writing `active-version.txt`.
- Managed install/update/reinstall and rollback attempts should publish a structured Latest result summary with cache source, asset/binary paths, verification status, and plain-English recovery guidance on failure.
- Exporter detection should prefer the active managed binary, then a verified user-selected binary saved in app data, then `PATH`.
- Startup health checks should fetch latest release metadata so the UI can show update availability without a manual **Check release** click. This check is metadata-only and must not install, run exports, or run upstream diagnostics by itself.
- Prefer direct executable release assets over `.tar.gz` archives, but managed installs should extract the expected exporter binary from `.tar.gz` assets when a direct binary is not available.
- The Tauri desktop runtime owns filesystem writes, managed installs, and durable user settings. Development-harness fallback state must not become a supported web-app behavior.

# Distribution

- ChatExportMate is currently an experimental alpha. Keep package metadata, README language, and CI artifact names aligned with that alpha posture until the user decides it is stable enough for normal releases.
- GitHub Actions publishes Windows x64 alpha artifacts from `.github/workflows/desktop-alpha-build.yml` in two forms: an unsigned NSIS setup installer and a portable app folder containing the release executable plus license/readme files.
- The portable artifact should avoid system install integration, shortcuts, and uninstallers, but it still uses the normal ChatExportMate app data location for managed exporter binaries, preferences, and logs.
- If the portable executable appears to be running from a temporary compressed-folder location, the app should warn the user to extract the ZIP before continuing. This warning is about launch stability and is separate from export output-folder writability.
- Keep the MSI target disabled while using human-readable alpha prerelease versions such as `0.1.0-alpha.0`; Tauri's MSI bundler rejects non-numeric prerelease identifiers.

# Export Execution And Logs

- Export options should be restored from local desktop app data on startup and saved back after changes. The Tauri runtime owns the app-data JSON file.
- User-started exports execute through the Tauri backend using `std::process::Command`.
- Export and diagnostic process output should be streamed from the Tauri backend to the Progress panel through typed events while still collecting complete stdout/stderr for saved local logs.
- Every backend export attempt should write a local log under app data `run-logs/`, including command, stdout, stderr, exit code, timestamps, and output path.
- The Progress panel is driven by the testable `src/domain/exporter/runProgress.ts` model. Keep operation stages in that domain module instead of scattering stage labels through React handlers.
- The live process output list is UI-only, capped, and filtered by a per-run event id. Do not treat the Vite browser harness as capable of real exporter process streaming.
- The History UI lists persisted app-data export and diagnostic logs through a Tauri command, filters them locally in domain code, and opens selected log files locally; the development browser harness should show an empty stored-log list rather than fake desktop files.
- Saved log previews are read through a Tauri command constrained to known app-data log roots and `.log` filenames. Keep previews local, capped for large files, and paired with a privacy reminder before sharing.
- Support bundles should be created locally under app data `support-bundles/`, copy saved logs, include a short manifest, and remind users to review logs before sharing them.
- The UI should translate failed exporter output through the error translation domain module rather than showing raw stderr as the primary message.
- Export readiness should be derived from the tested preflight summary domain module; normal users either set up the missing requirement or start the export.
- When a real export is blocked by a missing exporter and a compatible release asset is known, the Export page should surface managed install as the primary repair action so users do not have to discover the Diagnostics page first.
- Export form validation should surface near the fields that need correction as well as in preflight summaries; users should not need to inspect generated command details to understand configuration issues.
- Latest export and diagnostic results should show a structured explanation, likely cause, suggested fix, saved log path when available, and optional raw details; keep the activity log concise.
- Latest export results should expose desktop actions to open the exported output folder and saved log when those paths are available. Diagnostic results should expose the saved log action when available.
- The development browser harness must not pretend to execute exports; it should return a clear desktop-runtime-only message.
- CSV is an app-owned format. Do not send `-f csv` to upstream unless upstream explicitly supports it. Spenlio finance CSV layouts should read local Messages database fields through upstream ReagentX libraries, preserve Apple `message.guid` where present, fall back to the SQLite message row ID when needed, and apply a conservative sender filter that skips phone-number conversations, email senders, non-SMS services, and the user's own sent messages. Those finance layouts do not require an external exporter executable in validation, preflight, or backend execution. For encrypted iPhone backups, keep the decrypted database in memory rather than a temp file. Keep the `sender`, `received_at`, `message_id`, `message` contract, the per-sender finance CSV layout, and the legacy transcript-line layout as text-export post-processing with `transcript_file`, `line_number`, `text`.

# Diagnostics

- App-level health checks refresh platform, exporter detection, executable launch access, managed store, release, configuration, output write access, and privacy state.
- Desktop health checks should verify output write access locally by creating/removing a temporary file in the selected output folder or its existing parent when the target folder is not created yet.
- Setup permission guidance is derived in domain code, not hardcoded inside React components. It should cover macOS Full Disk Access for local Messages exports, iOS backup-folder access, output write access, and the local-only privacy boundary.
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
- optional real-backup smoke coverage through the ignored `local_iphone_backup_structured_csv_smoke_export` Rust test; run it only with explicit `CHAT_EXPORT_MATE_REAL_BACKUP_PATH` and `CHAT_EXPORT_MATE_REAL_OUTPUT_PATH`, and keep output outside the repo

# UX Notes

- The first screen should be a usable desktop app workspace with fast-start setup guidance, not a marketing page.
- Primary navigation should switch between real in-app pages such as Setup, Export, Diagnostics, Support, and About. Do not present all major workflows as one long fake section stack with anchor links.
- The beginner experience should be a guided wizard: set up exporter, choose source, choose output folder, choose format, run export. Logs and raw troubleshooting details should not sit in the main setup path.
- The source step should ask what the user needs to do in task terms such as "I need to create a backup", "I already created a backup", or "I am on the Mac with Messages"; do not lead with platform names or database terminology.
- Setup steps should render as four full-width ordered cards, not a two-column grid. The order must be visually unambiguous: 1 exporter, 2 message source, 3 output folder, 4 export.
- Do not expose dry-run or preview mode as a normal-user workflow. If command generation needs a development path, keep it behind developer/troubleshooting affordances.
- Keep the normal export action path visible in the first desktop viewport. Collapse or de-emphasize advanced options before hiding primary setup/export actions below the fold.
- Avoid showing long runtime-derived app-data paths in high-level setup/status copy. Full paths belong in diagnostics details, logs, support bundles, or raw troubleshooting output where wrapping and privacy reminders are present.
- Translate technical failures into a plain-English explanation, likely cause, suggested fix, and optional raw details.
- Keep raw command details out of the beginner flow; expose them only in logs or developer/troubleshooting contexts where they help diagnose an issue.
