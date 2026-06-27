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
    title: "Preparing dry run",
    detail: "ChatExportMate is building the command preview without writing export files.",
    steps: [
      {
        id: "build-command",
        label: "Build command",
        detail: "Create the imessage-exporter arguments from the selected options.",
      },
      {
        id: "ready",
        label: "Ready to review",
        detail: "Show the generated command for review.",
      },
    ],
  },
  export: {
    title: "Running export",
    detail: "ChatExportMate is handing the configured export to imessage-exporter.",
    steps: [
      {
        id: "preflight",
        label: "Review setup",
        detail: "Confirm the exporter, configuration, permissions, and destination are ready.",
      },
      {
        id: "output-access",
        label: "Check destination",
        detail: "Verify that the selected output folder can be written.",
      },
      {
        id: "run-exporter",
        label: "Run exporter",
        detail: "Let imessage-exporter read the local source and write the export.",
      },
      {
        id: "save-log",
        label: "Save run log",
        detail: "Capture command, stdout, stderr, exit code, and timestamps locally.",
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
        detail: "Execute imessage-exporter diagnostics through the desktop runtime.",
      },
      {
        id: "save-log",
        label: "Save diagnostic log",
        detail: "Capture the diagnostic command and process output locally.",
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
    detail: "ChatExportMate is installing or updating the managed imessage-exporter binary.",
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
