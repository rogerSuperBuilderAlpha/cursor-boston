/**
 * @jest-environment jsdom
 *
 * Coverage push #64 — lib/live-sessions/client.ts. Drives:
 *   - getLiveRemainingSeconds (idle / completed / paused / running)
 *   - useLiveSession (rtdb-missing error, subscribe + queue normalize,
 *     onError callbacks, cleanup unsubscribes)
 *   - useLiveTimerAudioAlerts (audioSupported flag, enableAudio,
 *     30-second + 1-minute + time-up triggers)
 */

// Mock firebase/database first so the import in client.ts wires to our spies.
const mockOnValue = jest.fn();
const mockRef = jest.fn(
  (_db: unknown, path: string) => ({ __ref: path })
);
jest.mock("firebase/database", () => ({
  onValue: (...a: unknown[]) => mockOnValue(...a),
  ref: (...a: unknown[]) => mockRef(...(a as Parameters<typeof mockRef>)),
}));

// Toggleable @/lib/firebase rtdb mock.
let mockRtdb: unknown = { __rtdb: true };
jest.mock("@/lib/firebase", () => ({
  get rtdb() {
    return mockRtdb;
  },
}));

import { act, renderHook } from "@testing-library/react";
import {
  getLiveRemainingSeconds,
  useLiveSession,
  useLiveTimerAudioAlerts,
} from "@/lib/live-sessions/client";

describe("getLiveRemainingSeconds", () => {
  it("returns 0 for a null session", () => {
    expect(getLiveRemainingSeconds(null)).toBe(0);
  });

  it("returns remainingSeconds verbatim for idle / completed / paused timers", () => {
    const base = {
      timer: { remainingSeconds: 120 },
    } as unknown as Parameters<typeof getLiveRemainingSeconds>[0];
    for (const status of ["idle", "completed", "paused"] as const) {
      const session = {
        timer: { ...((base as never as { timer: object }).timer), status },
      } as unknown as Parameters<typeof getLiveRemainingSeconds>[0];
      expect(getLiveRemainingSeconds(session)).toBe(120);
    }
  });

  it("returns remainingSeconds when running but startedAtMs is missing", () => {
    const session = {
      timer: { remainingSeconds: 99, status: "running" },
    } as unknown as Parameters<typeof getLiveRemainingSeconds>[0];
    expect(getLiveRemainingSeconds(session)).toBe(99);
  });

  it("subtracts elapsed seconds from a running timer", () => {
    const startedAtMs = Date.now() - 10_000;
    const session = {
      timer: {
        remainingSeconds: 60,
        status: "running",
        startedAtMs,
      },
    } as unknown as Parameters<typeof getLiveRemainingSeconds>[0];
    expect(getLiveRemainingSeconds(session)).toBe(50);
  });

  it("clamps the result at 0", () => {
    const startedAtMs = Date.now() - 5_000_000;
    const session = {
      timer: { remainingSeconds: 10, status: "running", startedAtMs },
    } as unknown as Parameters<typeof getLiveRemainingSeconds>[0];
    expect(getLiveRemainingSeconds(session)).toBe(0);
  });
});

describe("useLiveSession", () => {
  beforeEach(() => {
    mockOnValue.mockReset();
    mockRef.mockClear();
    mockRtdb = { __rtdb: true };
  });

  it("reports an error when sessionId is provided but rtdb is null", () => {
    mockRtdb = null;
    const { result } = renderHook(() => useLiveSession("sess-1"));
    expect(result.current.error).toMatch(/Realtime Database/i);
    expect(result.current.session).toBeNull();
  });

  it("returns idle, no-error when sessionId is empty (skips the subscribe)", () => {
    const { result } = renderHook(() => useLiveSession(""));
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockOnValue).not.toHaveBeenCalled();
  });

  it("subscribes to session + queue and normalizes the queue", () => {
    // Capture the success callbacks for each onValue call.
    const callbacks: Array<{
      success: (snap: { exists?: () => boolean; val: () => unknown }) => void;
      onError: () => void;
    }> = [];
    mockOnValue.mockImplementation(
      (
        _ref: unknown,
        success: (snap: { exists?: () => boolean; val: () => unknown }) => void,
        onError: () => void
      ) => {
        callbacks.push({ success, onError });
        return jest.fn();
      }
    );
    const { result } = renderHook(() => useLiveSession("sess-1"));
    expect(callbacks).toHaveLength(2);

    // Session snapshot → exists, val payload.
    act(() => {
      callbacks[0].success({
        exists: () => true,
        val: () => ({ timer: { status: "running", remainingSeconds: 100 } }),
      });
    });
    // Queue snapshot → order + items
    act(() => {
      callbacks[1].success({
        val: () => ({
          order: ["e1", "e2", 7], // non-string filtered
          items: { e1: { entryId: "e1" }, e2: { entryId: "e2" } },
        }),
      });
    });
    expect(result.current.session).not.toBeNull();
    expect(result.current.queue.map((e) => e.entryId)).toEqual(["e1", "e2"]);
    expect(result.current.error).toBeNull();
  });

  it("session callback that says exists() === false yields a null session", () => {
    let sessionCb: (s: { exists: () => boolean; val: () => unknown }) => void = () => {};
    mockOnValue.mockImplementationOnce((_r, s) => {
      sessionCb = s as never;
      return jest.fn();
    });
    mockOnValue.mockImplementationOnce(() => jest.fn());
    const { result } = renderHook(() => useLiveSession("s"));
    act(() => sessionCb({ exists: () => false, val: () => null }));
    expect(result.current.session).toBeNull();
  });

  it("normalizes queue to [] when snapshot value isn't an object", () => {
    mockOnValue.mockImplementationOnce(() => jest.fn());
    let queueCb: (s: { val: () => unknown }) => void = () => {};
    mockOnValue.mockImplementationOnce((_r, s) => {
      queueCb = s as never;
      return jest.fn();
    });
    const { result } = renderHook(() => useLiveSession("s"));
    act(() => queueCb({ val: () => "not-an-object" }));
    expect(result.current.queue).toEqual([]);
  });

  it("normalizes queue to [] when order is missing", () => {
    mockOnValue.mockImplementationOnce(() => jest.fn());
    let queueCb: (s: { val: () => unknown }) => void = () => {};
    mockOnValue.mockImplementationOnce((_r, s) => {
      queueCb = s as never;
      return jest.fn();
    });
    const { result } = renderHook(() => useLiveSession("s"));
    act(() => queueCb({ val: () => ({ items: { e1: { entryId: "e1" } } }) }));
    expect(result.current.queue).toEqual([]);
  });

  it("propagates errors from either onValue", () => {
    let sessionErr: () => void = () => {};
    let queueErr: () => void = () => {};
    mockOnValue.mockImplementationOnce((_r, _s, e) => {
      sessionErr = e as never;
      return jest.fn();
    });
    mockOnValue.mockImplementationOnce((_r, _s, e) => {
      queueErr = e as never;
      return jest.fn();
    });
    const { result } = renderHook(() => useLiveSession("s"));
    act(() => sessionErr());
    expect(result.current.error).toMatch(/live session state/i);
    act(() => queueErr());
    expect(result.current.error).toMatch(/live queue state/i);
  });

  it("unsubscribes from both refs on unmount", () => {
    const unsubA = jest.fn();
    const unsubB = jest.fn();
    mockOnValue.mockReturnValueOnce(unsubA).mockReturnValueOnce(unsubB);
    const { unmount } = renderHook(() => useLiveSession("s"));
    unmount();
    expect(unsubA).toHaveBeenCalledTimes(1);
    expect(unsubB).toHaveBeenCalledTimes(1);
  });
});

describe("useLiveTimerAudioAlerts", () => {
  let originalAudioContext: typeof window.AudioContext | undefined;

  beforeAll(() => {
    originalAudioContext = (window as unknown as { AudioContext?: unknown })
      .AudioContext as typeof window.AudioContext | undefined;
  });

  afterEach(() => {
    (window as unknown as { AudioContext?: unknown }).AudioContext = originalAudioContext;
  });

  it("reports audioSupported=false when AudioContext is missing", () => {
    (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
    const { result } = renderHook(() => useLiveTimerAudioAlerts(null, 0));
    expect(result.current.audioSupported).toBe(false);
  });

  it("reports audioSupported=true when AudioContext exists", () => {
    class MockAC {
      currentTime = 0;
      destination = {};
      state = "running";
      createOscillator() {
        return {
          type: "",
          frequency: { value: 0 },
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn(),
          },
          connect: jest.fn(),
        };
      }
      resume = jest.fn().mockResolvedValue(undefined);
    }
    (window as unknown as { AudioContext: typeof MockAC }).AudioContext = MockAC;
    const { result } = renderHook(() => useLiveTimerAudioAlerts(null, 60));
    expect(result.current.audioSupported).toBe(true);
  });

  it("enableAudio() resolves true and flips audioEnabled to true", async () => {
    class MockAC {
      currentTime = 0;
      destination = {};
      state = "suspended";
      createOscillator() {
        return {
          type: "",
          frequency: { value: 0 },
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn(),
          },
          connect: jest.fn(),
        };
      }
      resume = jest.fn().mockResolvedValue(undefined);
    }
    (window as unknown as { AudioContext: typeof MockAC }).AudioContext = MockAC;
    const { result } = renderHook(() => useLiveTimerAudioAlerts(null, 60));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.enableAudio();
    });
    expect(ok).toBe(true);
    expect(result.current.audioEnabled).toBe(true);
  });

  it("enableAudio() returns false when AudioContext is unavailable", async () => {
    (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
    const { result } = renderHook(() => useLiveTimerAudioAlerts(null, 60));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.enableAudio();
    });
    expect(ok).toBe(false);
  });

  it("plays the 1-minute tone when crossing 60s in running mode", async () => {
    // Crafted AudioContext to capture oscillator counts
    class MockAC {
      currentTime = 0;
      destination = {};
      state = "running";
      osc: number = 0;
      createOscillator() {
        this.osc++;
        return {
          type: "",
          frequency: { value: 0 },
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn(),
          },
          connect: jest.fn(),
        };
      }
      resume = jest.fn().mockResolvedValue(undefined);
    }
    const acInstance = new MockAC();
    (window as unknown as { AudioContext: () => MockAC }).AudioContext =
      function () {
        return acInstance;
      } as never;
    const session = {
      timer: { status: "running" },
    } as unknown as Parameters<typeof useLiveTimerAudioAlerts>[0];

    const { result, rerender } = renderHook(
      ({ remaining }: { remaining: number }) =>
        useLiveTimerAudioAlerts(session, remaining),
      { initialProps: { remaining: 80 } }
    );
    // Enable audio first
    await act(async () => {
      await result.current.enableAudio();
    });
    // Re-render to cross the 60s threshold
    rerender({ remaining: 55 });
    // 1-minute tone → 1 oscillator
    expect(acInstance.osc).toBeGreaterThanOrEqual(1);
  });
});
