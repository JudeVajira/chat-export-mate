import type { ProcessOutputEvent, ProcessOutputKind } from "./types";

export const DEFAULT_PROCESS_OUTPUT_LIMIT = 50;

export function appendProcessOutputEvent(
  currentEvents: ProcessOutputEvent[],
  nextEvent: ProcessOutputEvent,
  limit = DEFAULT_PROCESS_OUTPUT_LIMIT,
): ProcessOutputEvent[] {
  const normalizedLimit = Math.max(0, Math.floor(limit));
  if (normalizedLimit === 0) {
    return [];
  }

  return [...currentEvents, nextEvent].slice(-normalizedLimit);
}

export function createProcessEventId(
  kind: ProcessOutputKind,
  now = Date.now,
  random = Math.random,
): string {
  return `${kind}-${now()}-${random().toString(36).slice(2, 10)}`;
}

export function isProcessOutputForRun(
  event: ProcessOutputEvent,
  activeEventId: string | null | undefined,
): boolean {
  return Boolean(activeEventId) && event.eventId === activeEventId;
}
