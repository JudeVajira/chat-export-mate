import { describe, expect, it } from "vitest";
import { groupValidationIssues, validationMessagesFor } from "./validation";
import type { ValidationIssue } from "./types";

describe("validation issue helpers", () => {
  it("groups validation messages by field while preserving message order", () => {
    const issues: ValidationIssue[] = [
      { field: "outputPath", message: "Choose an output folder." },
      { field: "startDate", message: "Start date must use YYYY-MM-DD." },
      { field: "outputPath", message: "Output folder is not writable." },
    ];

    const grouped = groupValidationIssues(issues);

    expect(grouped).toEqual({
      outputPath: ["Choose an output folder.", "Output folder is not writable."],
      startDate: ["Start date must use YYYY-MM-DD."],
    });
  });

  it("returns an empty list when a field has no validation messages", () => {
    expect(validationMessagesFor({}, "databasePath")).toEqual([]);
  });
});
