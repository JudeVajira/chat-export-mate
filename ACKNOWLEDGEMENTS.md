# Acknowledgements

ChatExportMate is a graphical desktop companion for
[ReagentX/imessage-exporter](https://github.com/ReagentX/imessage-exporter).
The upstream exporter remains the source of truth for diagnostics and the main
HTML/Text export behavior.

The Spenlio-compatible CSV feature is an app-owned export path inspired by the
upstream project. It uses ReagentX Rust libraries to read local Messages
database fields so ChatExportMate can preserve Apple message identifiers where
the database exposes them.

## Upstream Project

- Project: `ReagentX/imessage-exporter`
- Repository: <https://github.com/ReagentX/imessage-exporter>
- License: GPL-3.0

ChatExportMate discovers, downloads, configures, executes, and presents results
from `imessage-exporter`. It does not try to be a replacement Messages exporter;
format-specific features should stay narrow, local-first, and attributed to the
upstream ecosystem they build on.

## ChatExportMate License

ChatExportMate is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE) for
the full license text.

This project is provided without warranty. Users should review local logs and
support bundles before sharing them in bug reports because those files can
contain local paths, command arguments, stdout, stderr, and other
troubleshooting details.
