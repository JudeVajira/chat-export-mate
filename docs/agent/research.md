---
type: research
title: Repo Research
description: Reusable external references for ChatExportMate.
scope: repo-wide
status: active
tags: [tauri, tailwind, imessage-exporter, github-releases]
last_checked: 2026-06-29
sources:
  - https://tauri.app/develop/calling-rust/
  - https://v2.tauri.app/reference/javascript/api/namespacepath/
  - https://v2.tauri.app/plugin/dialog/
  - https://tailwindcss.com/docs/installation/using-vite
  - https://support.apple.com/guide/mac-help/change-privacy-security-settings-on-mac-mchl211c911f/mac
  - https://support.apple.com/en-us/108967
  - https://support.apple.com/en-us/108809
  - https://discussions.apple.com/docs/DOC-7392#relocate
  - https://github.com/ReagentX/imessage-exporter
  - https://raw.githubusercontent.com/ReagentX/imessage-exporter/develop/LICENSE
  - https://raw.githubusercontent.com/ReagentX/imessage-exporter/develop/imessage-exporter/README.md
  - https://github.com/ReagentX/imessage-exporter/releases
  - https://docs.rs/imessage-database/4.2.0
  - https://crates.io/crates/imessage-database/4.2.0
  - https://docs.rs/crabapple/0.4.7
  - https://crates.io/crates/crabapple/0.4.7
related:
  - ./product-architecture.md
---

# Useful Sources

- Title: Tauri v2 - Calling Rust from the frontend
  URL: https://tauri.app/develop/calling-rust/
  Why it matters: Confirms the frontend-to-backend command invocation model used by this Tauri app.
  Last checked: 2026-06-27 12:03 +05:30

- Title: Tauri v2 path API
  URL: https://v2.tauri.app/reference/javascript/api/namespacepath/
  Why it matters: App data directory semantics inform where managed exporter binaries should live.
  Last checked: 2026-06-27 12:32 +05:30

- Title: Tauri v2 dialog plugin
  URL: https://v2.tauri.app/plugin/dialog/
  Why it matters: Confirms the desktop plugin used for native file and folder pickers in the export setup flow.
  Last checked: 2026-06-27 13:16 +05:30

- Title: Tailwind CSS - Install with Vite
  URL: https://tailwindcss.com/docs/installation/using-vite
  Why it matters: Confirms the current Vite integration path using `tailwindcss` and `@tailwindcss/vite`.
  Last checked: 2026-06-27 12:03 +05:30

- Title: Apple macOS privacy and security settings
  URL: https://support.apple.com/guide/mac-help/change-privacy-security-settings-on-mac-mchl211c911f/mac
  Why it matters: Confirms the current macOS System Settings path for Full Disk Access guidance in setup permissions.
  Last checked: 2026-06-27 16:05 +05:30

- Title: Apple Support - Back up iPhone
  URL: https://support.apple.com/en-us/108967
  Why it matters: Confirms beginner-facing local iPhone backup guidance, including Windows Apple Devices/iTunes backup flow, Trust This Computer, encrypted backup option, Back Up Now, and locating backups through Manage Backups / Show in Explorer.
  Last checked: 2026-06-28 22:28 +05:30

- Title: Apple Support - Locate iPhone backups
  URL: https://support.apple.com/en-us/108809
  Why it matters: Confirms the current Apple-supported entry points for locating local iPhone backup folders on Windows and macOS. ChatExportMate uses these as the default scan roots before asking users to browse manually.
  Last checked: 2026-06-29 12:23 +05:30

- Title: Apple Community - Locate backups and relocate iOS device backups
  URL: https://discussions.apple.com/docs/DOC-7392#relocate
  Why it matters: Gives the repo-relevant relocation pattern: move the default MobileSync Backup folder and replace it with a filesystem link, so scanning Apple's default path can still find backups when the link is intact.
  Last checked: 2026-06-29 12:23 +05:30

- Title: ReagentX/imessage-exporter
  URL: https://github.com/ReagentX/imessage-exporter
  Why it matters: Upstream exporter project that ChatExportMate wraps and attributes.
  Last checked: 2026-06-27 14:05 +05:30

- Title: imessage-exporter license
  URL: https://raw.githubusercontent.com/ReagentX/imessage-exporter/develop/LICENSE
  Why it matters: Confirms upstream GPL-3.0 licensing for ChatExportMate attribution and compatibility notes.
  Last checked: 2026-06-27 14:05 +05:30

- Title: imessage-exporter binary documentation
  URL: https://raw.githubusercontent.com/ReagentX/imessage-exporter/develop/imessage-exporter/README.md
  Why it matters: Source for supported CLI flags, formats, platform/source arguments, diagnostics, and examples used by command generation.
  Last checked: 2026-06-29 13:02 +05:30
  Notes: Rechecked iOS backup handling. Upstream documents encrypted backup support through `--cleartext-password` or an interactive password prompt. ChatExportMate uses the prompt path by piping the current-run password through stdin and must not use `--cleartext-password` in the normal app flow.

- Title: imessage-exporter releases
  URL: https://github.com/ReagentX/imessage-exporter/releases
  Why it matters: Release feed used to discover versions and downloadable exporter assets dynamically; API check found latest version `4.2.0` with direct binaries and `.tar.gz` archives on 2026-06-27, but future work should re-check live.
  Last checked: 2026-06-27 15:02 +05:30

- Title: imessage-database crate documentation
  URL: https://docs.rs/imessage-database/4.2.0
  Why it matters: ReagentX library used by ChatExportMate's Spenlio-compatible CSV path to read local Messages database rows, services, handles, dates, and message body fields while preserving Apple message identifiers.
  Last checked: 2026-06-29 20:25 +05:30
  Notes: `cargo info imessage-database` reported version `4.2.0`, GPL-3.0-or-later, and repository `https://github.com/ReagentX/imessage-exporter`.

- Title: imessage-database crate package
  URL: https://crates.io/crates/imessage-database/4.2.0
  Why it matters: Confirms the packaged crate metadata used by Cargo for the app-owned structured CSV implementation.
  Last checked: 2026-06-29 20:25 +05:30

- Title: crabapple crate documentation
  URL: https://docs.rs/crabapple/0.4.7
  Why it matters: ReagentX library used to open encrypted iOS backups and stream the decrypted Messages database into an in-memory SQLite connection for the current finance CSV export only.
  Last checked: 2026-06-29 20:25 +05:30
  Notes: `cargo info crabapple` reported version `0.4.7`, GPL-3.0-or-later, and repository `https://github.com/ReagentX/crabapple`.

- Title: crabapple crate package
  URL: https://crates.io/crates/crabapple/0.4.7
  Why it matters: Confirms the packaged crate metadata used by Cargo for encrypted iOS backup handling.
  Last checked: 2026-06-29 20:25 +05:30
