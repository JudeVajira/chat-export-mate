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
- Do not reimplement iMessage parsing. The upstream `imessage-exporter` CLI remains the parsing source of truth.
- Keep message data local. Do not add accounts, cloud sync, default analytics, or any network path for conversations.
- Development is Windows-first today, but platform behavior must be isolated so macOS support can be added later.
- Use dependency inversion for exporter discovery, release lookup, command execution, diagnostics, and filesystem/platform access so fake exporters and dry-run flows are testable on Windows.
- Keep UI code separate from command-generation, release parsing, validation, error translation, and logging logic.

## Workflow
- Use `pnpm` for frontend package management in this repo.
- Rust/Cargo is required for full Tauri desktop builds; frontend typecheck/build and Vitest can run without Rust.
- Keep `README.md` accurate when setup, prerequisites, run commands, test commands, or platform requirements change.
- For substantive implementation, add focused tests around command generation, GitHub release parsing, validation, diagnostics, and error translation.

## Frontend
- Build the actual desktop utility surface first; do not replace app workflows with a landing page.
- Prefer calm, dense, readable product UI: clear status hierarchy, restrained color, stable panels, and native controls.
- Avoid nested cards, decorative orbs, marketing hero sections, telemetry-heavy UX, and raw CLI terminology unless it helps troubleshooting.
- For visual UI changes, capture Playwright screenshots at desktop and mobile widths and check for overflow, clipped controls, and text collisions before wrapping up.
