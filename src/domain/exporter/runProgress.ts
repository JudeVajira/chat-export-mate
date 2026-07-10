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
    title: "Exporting your messages",
    detail: "Your messages are being read locally and written to the save folder.",
    steps: [
      {
        id: "preflight",
        label: "Check your choices",
        detail: "Make sure the message source, options, and save folder are ready.",
      },
      {
        id: "output-access",
        label: "Check the save folder",
        detail: "Make sure files can be created in the folder you chose.",
      },
      {
        id: "run-exporter",
        label: "Save your messages",
        detail: "Read the messages on this computer and write your files.",
      },
      {
        id: "save-log",
        label: "Keep a record",
        detail: "Save the details of this run to the Activity list.",
      },
      {
        id: "finish",
        label: "Finish up",
        detail: "Prepare the result.",
      },
    ],
  },
  diagnostics: {
    title: "Running a check-up",
    detail: "The app is refreshing its status and running the export tool's own checks.",
    steps: [
      {
        id: "refresh-checks",
        label: "Refresh status",
        detail: "Update the export tool, folder, and configuration status.",
      },
      {
        id: "run-diagnostics",
        label: "Run the tool's own check",
        detail: "Ask the export tool to inspect the message source.",
      },
      {
        id: "save-log",
        label: "Keep a record",
        detail: "Save the check-up details to the Activity list.",
      },
      {
        id: "finish",
        label: "Finish up",
        detail: "Prepare the check-up result.",
      },
    ],
  },
  "managed-install": {
    title: "Getting the export tool",
    detail: "A small helper tool is downloaded and checked. This happens once.",
    steps: [
      {
        id: "check-release",
        label: "Find the latest version",
        detail: "Look up the newest release of the export tool.",
      },
      {
        id: "download",
        label: "Download it",
        detail: "Download the tool, or reuse an earlier download when possible.",
      },
      {
        id: "verify",
        label: "Make sure it works",
        detail: "Start the downloaded tool once to confirm it runs.",
      },
      {
        id: "activate",
        label: "Turn it on",
        detail: "Use the verified tool for exports from now on.",
      },
    ],
  },
  "managed-activation": {
    title: "Switching tool versions",
    detail: "A stored version of the export tool is checked before it takes over.",
    steps: [
      {
        id: "verify",
        label: "Check the stored version",
        detail: "Start the stored tool once to confirm it runs.",
      },
      {
        id: "activate",
        label: "Make it active",
        detail: "Use this version for exports from now on.",
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
