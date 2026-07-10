export function FieldIssues({ fieldId, issues }: { fieldId: string; issues: string[] }) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <ul className="field-error-list" id={`${fieldId}-errors`}>
      {issues.map((issue) => (
        <li key={issue}>{issue}</li>
      ))}
    </ul>
  );
}
