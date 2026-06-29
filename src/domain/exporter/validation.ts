import type { ValidationIssue } from "./types";

export type ValidationIssueMap = Partial<Record<ValidationIssue["field"], string[]>>;

export function groupValidationIssues(issues: ValidationIssue[]): ValidationIssueMap {
  return issues.reduce<ValidationIssueMap>((groupedIssues, issue) => {
    const existingIssues = groupedIssues[issue.field] ?? [];
    groupedIssues[issue.field] = [...existingIssues, issue.message];
    return groupedIssues;
  }, {});
}

export function validationMessagesFor(
  issues: ValidationIssueMap,
  field: ValidationIssue["field"],
): string[] {
  return issues[field] ?? [];
}
