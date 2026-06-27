import { describe, expect, it } from "vitest";
import {
  advanceRunProgress,
  completeRunProgress,
  failRunProgress,
  startRunProgress,
} from "./runProgress";

describe("run progress", () => {
  it("starts an export with the first step active and later steps pending", () => {
    const progress = startRunProgress("export", "2026-06-27T10:00:00.000Z");

    expect(progress).toMatchObject({
      kind: "export",
      state: "active",
      startedAt: "2026-06-27T10:00:00.000Z",
    });
    expect(progress.steps.map((step) => [step.id, step.state])).toEqual([
      ["preflight", "active"],
      ["output-access", "pending"],
      ["run-exporter", "pending"],
      ["save-log", "pending"],
      ["finish", "pending"],
    ]);
  });

  it("advances to a later step and completes prior steps", () => {
    const progress = advanceRunProgress(startRunProgress("export"), "run-exporter");

    expect(progress.state).toBe("active");
    expect(progress.steps.map((step) => [step.id, step.state])).toEqual([
      ["preflight", "completed"],
      ["output-access", "completed"],
      ["run-exporter", "active"],
      ["save-log", "pending"],
      ["finish", "pending"],
    ]);
  });

  it("marks all steps completed on success", () => {
    const progress = completeRunProgress(startRunProgress("diagnostics"), "Diagnostics completed.", "done");

    expect(progress.state).toBe("completed");
    expect(progress.completedAt).toBe("done");
    expect(progress.detail).toBe("Diagnostics completed.");
    expect(progress.steps.every((step) => step.state === "completed")).toBe(true);
  });

  it("marks the failed step and leaves later steps pending", () => {
    const progress = failRunProgress(
      startRunProgress("managed-install"),
      "download",
      "Release asset could not be downloaded.",
      "failed",
    );

    expect(progress.state).toBe("failed");
    expect(progress.completedAt).toBe("failed");
    expect(progress.steps.map((step) => [step.id, step.state])).toEqual([
      ["check-release", "completed"],
      ["download", "failed"],
      ["verify", "pending"],
      ["activate", "pending"],
    ]);
  });
});
