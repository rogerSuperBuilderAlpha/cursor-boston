/**
 * @jest-environment node
 *
 * Pure-helper tests for lib/live-sessions/client.ts. The React hooks
 * (useLiveSession, useLiveTimerAudioAlerts) are exercised end-to-end
 * via the live-session admin page Playwright tests; this file pins
 * getLiveRemainingSeconds, which is a pure function safe to test in
 * isolation.
 */
import { getLiveRemainingSeconds } from "@/lib/live-sessions/client";
import type { LiveSessionRealtimeRecord } from "@/lib/live-sessions/types";

type Timer = LiveSessionRealtimeRecord["timer"];

function mkSession(timer: Partial<Timer> & { status: Timer["status"] }): LiveSessionRealtimeRecord {
  return {
    timer: {
      remainingSeconds: 0,
      ...timer,
    } as Timer,
  } as unknown as LiveSessionRealtimeRecord;
}

describe("lib/live-sessions/client — getLiveRemainingSeconds", () => {
  it("returns 0 when session is null", () => {
    expect(getLiveRemainingSeconds(null)).toBe(0);
  });

  it("returns remainingSeconds verbatim when status is 'idle'", () => {
    expect(
      getLiveRemainingSeconds(mkSession({ status: "idle", remainingSeconds: 300 }))
    ).toBe(300);
  });

  it("returns remainingSeconds verbatim when status is 'completed'", () => {
    expect(
      getLiveRemainingSeconds(mkSession({ status: "completed", remainingSeconds: 42 }))
    ).toBe(42);
  });

  it("returns remainingSeconds verbatim when status is 'paused'", () => {
    expect(
      getLiveRemainingSeconds(mkSession({ status: "paused", remainingSeconds: 120 }))
    ).toBe(120);
  });

  it("returns remainingSeconds verbatim when running but startedAtMs is missing", () => {
    expect(
      getLiveRemainingSeconds(
        mkSession({ status: "running", remainingSeconds: 300, startedAtMs: undefined })
      )
    ).toBe(300);
  });

  it("decrements by elapsed seconds when running with startedAtMs", () => {
    const now = Date.now();
    const remaining = getLiveRemainingSeconds(
      mkSession({
        status: "running",
        remainingSeconds: 300,
        startedAtMs: now - 30_000, // 30 seconds ago
      })
    );
    // Allow ±2s for jitter
    expect(remaining).toBeGreaterThanOrEqual(268);
    expect(remaining).toBeLessThanOrEqual(272);
  });

  it("clamps to 0 when elapsed time exceeds remainingSeconds", () => {
    const remaining = getLiveRemainingSeconds(
      mkSession({
        status: "running",
        remainingSeconds: 5,
        startedAtMs: Date.now() - 60_000,
      })
    );
    expect(remaining).toBe(0);
  });

  it("clamps to 0 if startedAtMs is in the future (negative elapsed)", () => {
    const remaining = getLiveRemainingSeconds(
      mkSession({
        status: "running",
        remainingSeconds: 60,
        startedAtMs: Date.now() + 60_000,
      })
    );
    // Future-start = max(0, elapsed)=0, so remaining = 60 - 0 = 60.
    expect(remaining).toBe(60);
  });
});
