# ChatExportMate Agent Notes

This file is the repo-wide routing layer for agent work. It captures project-wide constraints, setup expectations, and where to find deeper notes.

## Navigation
- [docs/agent/product-architecture.md](docs/agent/product-architecture.md)
  Use for: product constraints, wrapper boundaries, architecture layering, privacy rules, and test strategy.
- [docs/agent/research.md](docs/agent/research.md)
  Use for: reusable official docs and upstream project references checked for this repo.

No local subtree `AGENTS.md` files exist yet.

## Codex Repo Memory Metadata
- `specVersion: 1`
- `initializerSkill: agents-md-init@2`
- `maintenanceSkill: repo-memory@3`
- `capabilities: adaptive-layout, eager-memory-updates, scoped-agents, convention-tracking, topic-files-optional, proactive-splitting, progressive-indexes, relationship-links, link-style-guidance, frontmatter-default, change-log-optional, large-tree-grouping, repo-skills-optional, research-memory-optional, reference-layers-optional, permissive-validation, validation-checklist`

## Project Constraints
- ChatExportMate is a Tauri, React, TypeScript, and Rust desktop companion for `ReagentX/imessage-exporter`.
- ChatExportMate is desktop-only. Do not build, position, or optimize it as a web app or mobile app.
- `pnpm dev` / browser rendering is a development harness for the Tauri frontend only; it is not a supported product surface.
- Do not reimplement general iMessage exporting. The upstream `imessage-exporter` CLI remains the source of truth for HTML/Text exports, diagnostics, and normal exporter behavior.
- CSV output is app-owned. The Spenlio finance layouts should read local Messages database fields through upstream ReagentX libraries so `message_id` can use Apple `message.guid` when available and SQLite message row IDs as a fallback. These finance layouts do not need an external exporter executable; HTML/Text, diagnostics, and legacy transcript-lines CSV still do. For encrypted iPhone backup finance CSV, do not write the decrypted Messages database to a temp file; stream it into an in-memory SQLite connection for the current run only. Keep the `sender`, `received_at`, `message_id`, `message` contract and conservative business-sender filtering.
- Keep message data local. Do not add accounts, cloud sync, default analytics, or any network path for conversations.
- Development is Windows-first today, but platform behavior must be isolated so macOS support can be added later.
- Use dependency inversion for exporter discovery, release lookup, command execution, diagnostics, and filesystem/platform access so fake exporters and dry-run flows are testable on Windows.
- Keep UI code separate from command-generation, release parsing, validation, error translation, and logging logic.

## Workflow
- Use `pnpm` for frontend package management in this repo.
- Rust/Cargo is required for full Tauri desktop builds; frontend typecheck/build and Vitest can run without Rust.
- On Windows, run `pnpm tauri build` from a Visual Studio Build Tools developer environment, or initialize it with `VsDevCmd.bat`, so Cargo can find MSVC libraries such as `msvcrt.lib`.
- Keep `README.md` accurate when setup, prerequisites, run commands, test commands, or platform requirements change.
- Never commit generated export outputs, portable build zips, installer artifacts, or local backup-derived files. Keep those under ignored locations such as `output/` or `artifacts/`, or outside the repo.
- For substantive implementation, add focused tests around command generation, GitHub release parsing, validation, diagnostics, and error translation.

## Frontend
- Build the actual desktop utility surface first; do not replace app workflows with a landing page.
- Prefer calm, dense, readable product UI: clear status hierarchy, restrained color, stable panels, and native controls.
- Avoid nested cards, decorative orbs, marketing hero sections, telemetry-heavy UX, and raw CLI terminology unless it helps troubleshooting.
- Setup flows must show the currently selected message source or iPhone backup folder and export folder inline, with obvious change and OS file-manager open actions. Do not collapse real local locations into vague labels like `Ready` or `Selected`.
- For visual UI changes, capture Playwright screenshots at practical desktop window widths and check for overflow, clipped controls, and text collisions before wrapping up. Do not add mobile-specific layouts beyond ordinary responsive resilience for narrow desktop windows.
