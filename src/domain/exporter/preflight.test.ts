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
      title: "Ready to export",
      actionLabel: "Start export",
      canRunExport: true,
      blockingReasons: [],
      recommendedAction: null,
    });
  });

  it("keeps dry-run available while explaining real export blockers", () => {
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
      title: "Preview available, export not ready",
      actionLabel: "Start dry run",
      canRunExport: false,
      blockingReasons: ["Output access: Desktop write access check has not run."],
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
      title: "Export needs attention",
      actionLabel: "Resolve preflight",
      canRunExport: false,
      blockingReasons: [
        "Exporter: imessage-exporter was not found",
        "Configuration: Choose an output folder for exported files.",
      ],
    });
  });

  it("recommends installing the managed exporter when the exporter is missing and an asset is available", () => {
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
      actionLabel: "Resolve preflight",
      recommendedAction: {
        id: "install-exporter",
        label: "Install exporter",
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
      nonBlockingNotes: ["Latest release: Version 4.3.0 is available"],
    });
  });
});
