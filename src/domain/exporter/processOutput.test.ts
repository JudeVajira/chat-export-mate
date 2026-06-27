import { describe, expect, it } from "vitest";
import {
  appendProcessOutputEvent,
  createProcessEventId,
  isProcessOutputForRun,
} from "./processOutput";
import type { ProcessOutputEvent } from "./types";

describe("process output", () => {
  it("keeps only the latest events within the requested limit", () => {
    const events = [1, 2, 3].map((line) => outputEvent(`line ${line}`));

    const nextEvents = appendProcessOutputEvent(events, outputEvent("line 4"), 2);

    expect(nextEvents.map((event) => event.line)).toEqual(["line 3", "line 4"]);
  });

  it("returns an empty list when the event limit is zero", () => {
    const nextEvents = appendProcessOutputEvent(
      [outputEvent("line 1")],
      outputEvent("line 2"),
      0,
    );

    expect(nextEvents).toEqual([]);
  });

  it("matches output events to the active process event id", () => {
    const event = outputEvent("line", "active-run");

    expect(isProcessOutputForRun(event, "active-run")).toBe(true);
    expect(isProcessOutputForRun(event, "stale-run")).toBe(false);
    expect(isProcessOutputForRun(event, null)).toBe(false);
  });

  it("creates stable event id prefixes for exports and diagnostics", () => {
    const eventId = createProcessEventId("diagnostic", () => 1234, () => 0.5);

    expect(eventId).toMatch(/^diagnostic-1234-/);
  });
});

function outputEvent(line: string, eventId = "run-1"): ProcessOutputEvent {
  return {
    eventId,
    kind: "export",
    line,
    stream: "stdout",
    timestamp: `2026-06-27T10:00:0${line.length}.000Z`,
  };
}
