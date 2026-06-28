import { describe, expect, it } from "vitest";
import { buildDiagnostics } from "./diagnostics";
import type {
  ExportOptions,
  ExporterProbe,
  ExporterRelease,
  ManagedExporterState,
  OutputAccessCheck,
  RuntimeTarget,
  SystemSnapshot,
} from "./types";

const snapshot: SystemSnapshot = {
  os: "windows",
  arch: "x64",
  family: "windows",
  default_exporter_name: "imessage-exporter.exe",
};

const probe: ExporterProbe = {
  found: true,
  managed: true,
  path: "C:/exporter/imessage-exporter.exe",
  version: "4.2.0",
  source: "managed",
};

const target: RuntimeTarget = {
  os: "windows",
  arch: "x64",
};

const options: ExportOptions = {
  format: "html",
  platform: "macOS",
  outputPath: "C:/exports",
  databasePath: "",
  attachmentRoot: "",
  copyMethod: "full",
  startDate: "",
  endDate: "",
  conversationFilter: "",
  customName: "",
  useCallerId: false,
  noLazyImages: false,
  ignoreDiskWarning: false,
  noProgress: true,
};

const managedState: ManagedExporterState = {
  installRoot: "C:/managed",
  activeVersion: "4.2.0",
  installedVersions: ["4.2.0"],
};

function diagnosticsWith(outputAccess: OutputAccessCheck) {
  return buildDiagnostics(
    snapshot,
    probe,
    null,
    target,
    probe.path ?? "",
    options,
    managedState,
    outputAccess,
  );
}

describe("buildDiagnostics", () => {
  it("passes executable access when exporter detection launched the binary", () => {
    const item = diagnosticsWith({
      path: options.outputPath,
      resolvedPath: options.outputPath,
      writable: true,
      checkedAt: "1",
      detail: "Output folder is writable.",
      error: null,
    }).find((diagnostic) => diagnostic.id === "executable-access");

    expect(item).toMatchObject({
      detail: "The exporter launched successfully and reported 4.2.0.",
      state: "passed",
    });
  });

  it("marks executable access as actionable when an exporter tool cannot launch", () => {
    const item = buildDiagnostics(
      snapshot,
      {
        found: false,
        path: "D:/Tools/imessage-exporter.exe",
        version: null,
        error: "Access is denied.",
        managed: false,
        source: "custom",
      },
      null,
      target,
      "D:/Tools/imessage-exporter.exe",
      options,
      managedState,
    ).find((diagnostic) => diagnostic.id === "executable-access");

    expect(item).toMatchObject({
      detail:
        "ChatExportMate found an exporter tool but could not launch it: Access is denied.",
      state: "action",
    });
  });

  it("warns that executable access cannot be checked before an exporter is available", () => {
    const item = buildDiagnostics(
      snapshot,
      {
        found: false,
        path: null,
        version: null,
        error: "imessage-exporter was not found",
        managed: false,
        source: "path",
      },
      null,
      target,
      "",
      options,
      managedState,
    ).find((diagnostic) => diagnostic.id === "executable-access");

    expect(item).toMatchObject({
      detail: "Set up or select an exporter before checking whether ChatExportMate can launch it.",
      state: "warning",
    });
  });

  it("passes output access when the destination is writable", () => {
    const item = diagnosticsWith({
      path: options.outputPath,
      resolvedPath: options.outputPath,
      writable: true,
      checkedAt: "1",
      detail: "Output folder is writable.",
      error: null,
    }).find((diagnostic) => diagnostic.id === "output-access");

    expect(item).toMatchObject({
      detail: "Output folder is writable.",
      state: "passed",
    });
  });

  it("marks output access as actionable when the desktop check fails", () => {
    const item = diagnosticsWith({
      path: options.outputPath,
      resolvedPath: options.outputPath,
      writable: false,
      checkedAt: "1",
      detail: "Output path points to a file. Choose a folder instead.",
      error: "not a directory",
    }).find((diagnostic) => diagnostic.id === "output-access");

    expect(item).toMatchObject({
      detail: "Output path points to a file. Choose a folder instead.",
      state: "action",
    });
  });

  it("labels a selected existing exporter as the detected source", () => {
    const item = buildDiagnostics(
      snapshot,
      {
        found: true,
        managed: false,
        path: "D:/Tools/imessage-exporter.exe",
        version: "4.2.0",
        source: "custom",
      },
      null,
      target,
      "D:/Tools/imessage-exporter.exe",
      options,
      managedState,
    ).find((diagnostic) => diagnostic.id === "exporter");

    expect(item).toMatchObject({
      detail: "Selected 4.2.0 at D:/Tools/imessage-exporter.exe",
      state: "passed",
    });
  });

  it("explains when the selected release asset is an archive", () => {
    const archiveRelease: ExporterRelease = {
      version: "4.2.0",
      releaseUrl: "https://example.test/release",
      assets: [
        {
          name: "imessage-exporter-x86_64-pc-windows-gnu.tar.gz",
          browser_download_url: "https://example.test/windows.tar.gz",
        },
      ],
    };

    const item = buildDiagnostics(
      snapshot,
      probe,
      archiveRelease,
      target,
      probe.path ?? "",
      options,
      managedState,
    ).find((diagnostic) => diagnostic.id === "asset");

    expect(item).toMatchObject({
      detail:
        "imessage-exporter-x86_64-pc-windows-gnu.tar.gz selected for x86_64-pc-windows-gnu; archive will be extracted after download",
      state: "passed",
    });
  });
});
