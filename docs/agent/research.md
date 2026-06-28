---
type: research
title: Repo Research
description: Reusable external references for ChatExportMate.
scope: repo-wide
status: active
tags: [tauri, tailwind, imessage-exporter, github-releases]
last_checked: 2026-06-27
sources:
  - https://tauri.app/develop/calling-rust/
  - https://v2.tauri.app/reference/javascript/api/namespacepath/
  - https://v2.tauri.app/plugin/dialog/
  - https://tailwindcss.com/docs/installation/using-vite
  - https://support.apple.com/guide/mac-help/change-privacy-security-settings-on-mac-mchl211c911f/mac
  - https://support.apple.com/en-us/108967
  - https://github.com/ReagentX/imessage-exporter
  - https://raw.githubusercontent.com/ReagentX/imessage-exporter/develop/LICENSE
  - https://raw.githubusercontent.com/ReagentX/imessage-exporter/develop/imessage-exporter/README.md
  - https://github.com/ReagentX/imessage-exporter/releases
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
  Last checked: 2026-06-27 14:12 +05:30
  Notes: Rechecked advanced export flags plus macOS `chat.db` and iOS backup-folder source semantics.

- Title: imessage-exporter releases
  URL: https://github.com/ReagentX/imessage-exporter/releases
  Why it matters: Release feed used to discover versions and downloadable exporter assets dynamically; API check found latest version `4.2.0` with direct binaries and `.tar.gz` archives on 2026-06-27, but future work should re-check live.
  Last checked: 2026-06-27 15:02 +05:30
