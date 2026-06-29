import { describe, expect, it } from "vitest";
import { buildExportPreflightSummary } from "./preflight";
import type { DiagnosticItem } from "./types";

const readyDiagnostics: DiagnosticItem[] = [
  {
    id: "exporter",
    label: "Exporter",
    detail: "Managed 4.2.0 at C:/exporter/imessage-exporter.exe",
    state: "passed",
  },
  {
    id: "asset",
    label: "Download asset",
    detail: "imessage-exporter.exe selected for x86_64-pc-windows-gnu",
    state: "passed",
  },
  {
    id: "configuration",
    label: "Configuration",
    detail: "Export options are ready",
    state: "passed",
  },
  {
    id: "output-access",
    label: "Output access",
    detail: "Output folder is writable.",
    state: "passed",
  },
];

describe("buildExportPreflightSummary", () => {
  it("allows a real export when exporter, configuration, and output checks pass", () => {
    expect(buildExportPreflightSummary(readyDiagnostics, false)).toMatchObject({
      state: "ready",
      title: "Ready to export messages",
      actionLabel: "Start export",
      canRunExport: true,
      blockingReasons: [],
      recommendedAction: null,
    });
  });

  it("keeps internal command checks available while explaining real export blockers", () => {
    expect(
      buildExportPreflightSummary(
        [
          ...readyDiagnostics.filter((item) => item.id !== "output-access"),
          {
            id: "output-access",
            label: "Output access",
            detail: "Desktop write access check has not run.",
            state: "warning",
          },
        ],
        true,
      ),
    ).toMatchObject({
      state: "warning",
      title: "Command check available, export not ready",
      actionLabel: "Check command",
      canRunExport: false,
      blockingReasons: ["Choose where ChatExportMate should save your exported messages."],
    });
  });

  it("blocks real export until required preflight checks are resolved", () => {
    expect(
      buildExportPreflightSummary(
        [
          {
            id: "exporter",
            label: "Exporter",
            detail: "imessage-exporter was not found",
            state: "action",
          },
          {
            id: "configuration",
            label: "Configuration",
            detail: "Choose an output folder for exported files.",
            state: "action",
          },
        ],
        false,
      ),
    ).toMatchObject({
      state: "blocked",
      title: "Finish setup before exporting",
      actionLabel: "Finish setup",
      canRunExport: false,
      blockingReasons: [
        "Install the export tool so ChatExportMate can read your local backup.",
        "Choose an output folder for exported files.",
      ],
    });
  });

  it("recommends setting up the managed exporter when the exporter is missing and an asset is available", () => {
    expect(
      buildExportPreflightSummary(
        [
          {
            id: "exporter",
            label: "Exporter",
            detail: "imessage-exporter was not found",
            state: "action",
          },
          {
            id: "asset",
            label: "Download asset",
            detail: "imessage-exporter.exe selected for x86_64-pc-windows-gnu",
            state: "passed",
          },
          {
            id: "configuration",
            label: "Configuration",
            detail: "Export options are ready",
            state: "passed",
          },
          {
            id: "output-access",
            label: "Output access",
            detail: "Output folder is writable.",
            state: "passed",
          },
        ],
        false,
      ),
    ).toMatchObject({
      state: "blocked",
      actionLabel: "Finish setup",
      recommendedAction: {
        id: "install-exporter",
        label: "Install export tool",
      },
    });
  });

  it("does not recommend managed install when no compatible release asset is available", () => {
    expect(
      buildExportPreflightSummary(
        [
          {
            id: "exporter",
            label: "Exporter",
            detail: "imessage-exporter was not found",
            state: "action",
          },
          {
            id: "asset",
            label: "Download asset",
            detail: "No compatible prebuilt asset selected for this platform",
            state: "action",
          },
        ],
        false,
      ),
    ).toMatchObject({
      recommendedAction: null,
    });
  });

  it("does not repeat executable access notes before the helper is ready", () => {
    expect(
      buildExportPreflightSummary(
        [
          {
            id: "exporter",
            label: "Exporter",
            detail: "imessage-exporter was not found",
            state: "action",
          },
          {
            id: "executable-access",
            label: "Executable access",
            detail: "Set up or select an exporter before checking whether ChatExportMate can launch it.",
            state: "warning",
          },
        ],
        false,
      ),
    ).toMatchObject({
      nonBlockingNotes: [],
    });
  });

  it("preserves non-blocking warning notes separately from blockers", () => {
    expect(
      buildExportPreflightSummary(
        [
          ...readyDiagnostics,
          {
            id: "release",
            label: "Latest release",
            detail: "Version 4.3.0 is available",
            state: "warning",
          },
        ],
        false,
      ),
    ).toMatchObject({
      state: "ready",
      canRunExport: true,
      nonBlockingNotes: ["Version 4.3.0 is available"],
    });
  });
});
