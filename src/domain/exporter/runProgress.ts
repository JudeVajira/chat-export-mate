export type RunOperationKind =
  | "dry-run"
  | "export"
  | "diagnostics"
  | "managed-install"
  | "managed-activation";

export type RunProgressStepState = "pending" | "active" | "completed" | "failed";

export interface RunProgressStep {
  id: string;
  label: string;
  detail: string;
  state: RunProgressStepState;
}

export interface RunProgress {
  kind: RunOperationKind;
  title: string;
  detail: string;
  startedAt: string;
  completedAt?: string;
  state: "active" | "completed" | "failed";
  steps: RunProgressStep[];
}

type RunProgressDefinition = {
  title: string;
  detail: string;
  steps: Array<Omit<RunProgressStep, "state">>;
};

const definitions: Record<RunOperationKind, RunProgressDefinition> = {
  "dry-run": {
    title: "Checking command",
    detail: "ChatExportMate is building exporter arguments without writing export files.",
    steps: [
      {
        id: "build-command",
        label: "Build command",
        detail: "Create the imessage-exporter arguments from the selected options.",
      },
      {
        id: "ready",
        label: "Command ready",
        detail: "Show the generated command for developer review.",
      },
    ],
  },
  export: {
    title: "Running export",
    detail: "ChatExportMate is creating the configured local export.",
    steps: [
      {
        id: "preflight",
        label: "Review setup",
        detail: "Confirm the selected source, configuration, permissions, and destination are ready.",
      },
      {
        id: "output-access",
        label: "Check destination",
        detail: "Verify that the selected output folder can be written.",
      },
      {
        id: "run-exporter",
        label: "Create export",
        detail: "Read the local source and write the selected output files.",
      },
      {
        id: "save-log",
        label: "Save troubleshooting details",
        detail: "Keep local details for support if something needs review.",
      },
      {
        id: "finish",
        label: "Finish",
        detail: "Prepare the result summary and exported-folder action.",
      },
    ],
  },
  diagnostics: {
    title: "Running diagnostics",
    detail: "ChatExportMate is refreshing local checks and then running upstream diagnostics.",
    steps: [
      {
        id: "refresh-checks",
        label: "Refresh checks",
        detail: "Update platform, exporter, managed store, release, and output access status.",
      },
      {
        id: "run-diagnostics",
        label: "Run exporter diagnostics",
        detail: "Run the exporter diagnostics from the desktop app.",
      },
      {
        id: "save-log",
        label: "Save troubleshooting details",
        detail: "Keep local diagnostic details for support.",
      },
      {
        id: "finish",
        label: "Finish",
        detail: "Prepare the diagnostics result summary.",
      },
    ],
  },
  "managed-install": {
    title: "Preparing exporter",
    detail: "ChatExportMate is setting up the managed exporter tool.",
    steps: [
      {
        id: "check-release",
        label: "Check release",
        detail: "Read the latest upstream release metadata.",
      },
      {
        id: "download",
        label: "Download or reuse asset",
        detail: "Select the platform asset and use the local cache when possible.",
      },
      {
        id: "verify",
        label: "Verify binary",
        detail: "Run the staged exporter version check before activation.",
      },
      {
        id: "activate",
        label: "Activate managed version",
        detail: "Make the verified binary the active managed exporter.",
      },
    ],
  },
  "managed-activation": {
    title: "Activating stored exporter",
    detail: "ChatExportMate is verifying a stored managed version before rollback activation.",
    steps: [
      {
        id: "verify",
        label: "Verify stored binary",
        detail: "Run the selected exporter version check.",
      },
      {
        id: "activate",
        label: "Activate stored version",
        detail: "Point future runs at the verified managed version.",
      },
    ],
  },
};

export function startRunProgress(
  kind: RunOperationKind,
  startedAt = new Date().toISOString(),
): RunProgress {
  const definition = definitions[kind];

  return {
    kind,
    title: definition.title,
    detail: definition.detail,
    startedAt,
    state: "active",
    steps: definition.steps.map((step, index) => ({
      ...step,
      state: index === 0 ? "active" : "pending",
    })),
  };
}

export function advanceRunProgress(
  progress: RunProgress,
  activeStepId: string,
  detail?: string,
): RunProgress {
  const activeStepIndex = progress.steps.findIndex((step) => step.id === activeStepId);
  if (activeStepIndex === -1) {
    return progress;
  }

  const steps = progress.steps.map((step, index) => {
    if (index === activeStepIndex) {
      return { ...step, detail: detail ?? step.detail, state: "active" as const };
    }

    return {
      ...step,
      state: index > activeStepIndex ? "pending" as const : "completed" as const,
    };
  });

  return {
    ...progress,
    detail: detail ?? progress.detail,
    state: "active",
    completedAt: undefined,
    steps,
  };
}

export function completeRunProgress(
  progress: RunProgress,
  detail: string,
  completedAt = new Date().toISOString(),
): RunProgress {
  return {
    ...progress,
    detail,
    completedAt,
    state: "completed",
    steps: progress.steps.map((step) => ({ ...step, state: "completed" })),
  };
}

export function failRunProgress(
  progress: RunProgress,
  failedStepId: string,
  detail: string,
  completedAt = new Date().toISOString(),
): RunProgress {
  const failedStepIndex = progress.steps.findIndex((step) => step.id === failedStepId);
  if (failedStepIndex === -1) {
    return {
      ...progress,
      detail,
      completedAt,
      state: "failed",
    };
  }

  const steps = progress.steps.map((step, index) => {
    if (index === failedStepIndex) {
      return { ...step, detail, state: "failed" as const };
    }

    return {
      ...step,
      state: index > failedStepIndex ? "pending" as const : "completed" as const,
    };
  });

  return {
    ...progress,
    detail,
    completedAt,
    state: "failed",
    steps,
  };
}
