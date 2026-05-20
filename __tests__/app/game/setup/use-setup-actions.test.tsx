/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/setup/_lib/use-setup-actions.ts`
 * (17% / 39 uncovered, no prior test). Covers `callApi` happy/error
 * paths and the full `runExploreBatch` batch loop including out-of-turns
 * early stop, batch-size clamping, error fallback, and signed-out no-ops.
 */

import React from "react";
import { act, render } from "@testing-library/react";
import { useSetupActions } from "@/app/game/setup/_lib/use-setup-actions";

const originalFetch = global.fetch;

afterAll(() => {
  global.fetch = originalFetch;
});

type Hook = ReturnType<typeof useSetupActions>;

function Probe({
  user,
  setError,
  refresh,
  capture,
}: {
  user: { getIdToken: () => Promise<string> } | null;
  setError: (m: string | null) => void;
  refresh: () => Promise<void>;
  capture: { current: Hook | null };
}) {
  const hook = useSetupActions({ user: user as never, setError, refresh });
  capture.current = hook;
  return null;
}

function setupHook(user: { getIdToken: () => Promise<string> } | null = { getIdToken: async () => "tok" }) {
  const capture: { current: Hook | null } = { current: null };
  const setError = jest.fn();
  const refresh = jest.fn(async () => undefined);
  render(<Probe user={user} setError={setError} refresh={refresh} capture={capture} />);
  return { capture, setError, refresh };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useSetupActions", () => {
  it("returns initial state busy=false, no batch progress, empty reveals", () => {
    const { capture } = setupHook(null);
    expect(capture.current?.busy).toBe(false);
    expect(capture.current?.batchProgress).toBeNull();
    expect(capture.current?.recentReveals).toEqual([]);
  });

  it("callApi: no-op when user is null", async () => {
    const { capture, refresh, setError } = setupHook(null);
    await act(async () => {
      await capture.current?.callApi("/api/x");
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it("callApi: success path calls refresh and clears error", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })) as never;
    const { capture, refresh, setError } = setupHook();
    await act(async () => {
      await capture.current?.callApi("/api/x", { foo: 1 });
    });
    expect(refresh).toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(null);
  });

  it("callApi: surfaces data.error.message on { success: false, error: { message } }", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: { message: "rate-limited" } }),
    })) as never;
    const { capture, setError, refresh } = setupHook();
    await act(async () => {
      await capture.current?.callApi("/api/x");
    });
    expect(setError).toHaveBeenCalledWith("rate-limited");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("callApi: surfaces data.error string when error is a string", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: "bad input" }),
    })) as never;
    const { capture, setError } = setupHook();
    await act(async () => {
      await capture.current?.callApi("/api/x");
    });
    expect(setError).toHaveBeenCalledWith("bad input");
  });

  it("callApi: falls back to 'Action failed' when no message is provided", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false }),
    })) as never;
    const { capture, setError } = setupHook();
    await act(async () => {
      await capture.current?.callApi("/api/x");
    });
    expect(setError).toHaveBeenCalledWith("Action failed");
  });

  it("callApi: catches fetch throw and surfaces Error message", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as never;
    const { capture, setError } = setupHook();
    await act(async () => {
      await capture.current?.callApi("/api/x");
    });
    expect(setError).toHaveBeenCalledWith("network down");
  });

  it("callApi: falls back to 'Action failed' on non-Error throw", async () => {
    global.fetch = jest.fn(async () => {
      throw "string-error";
    }) as never;
    const { capture, setError } = setupHook();
    await act(async () => {
      await capture.current?.callApi("/api/x");
    });
    expect(setError).toHaveBeenCalledWith("Action failed");
  });

  it("runExploreBatch: no-op when user is null", async () => {
    const { capture, refresh } = setupHook(null);
    await act(async () => {
      await capture.current?.runExploreBatch(3);
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("runExploreBatch: clamps batch count below 1 to 1", async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async () => {
      calls.push("call");
      return {
        ok: true,
        json: async () => ({
          success: true,
          tile: { tileId: "t1", type: "forest" },
          report: { summary: "ok", narrative: "n", artifactFound: false },
        }),
      };
    }) as never;
    const { capture } = setupHook();
    await act(async () => {
      await capture.current?.runExploreBatch(0);
    });
    expect(calls.length).toBe(1);
  });

  it("runExploreBatch: clamps batch count above 100 to 100 (and stops on first failure)", async () => {
    // Use a counter so we stop after a few iterations
    let n = 0;
    global.fetch = jest.fn(async () => {
      n++;
      return {
        ok: true,
        json: async () =>
          n < 3
            ? { success: true, tile: { tileId: "t" + n, type: "forest" }, report: { summary: "ok" } }
            : { success: false, error: "out of turns" },
      };
    }) as never;
    const { capture, setError } = setupHook();
    await act(async () => {
      await capture.current?.runExploreBatch(200);
    });
    // Should stop after the 3rd call returned success: false
    expect(setError).toHaveBeenCalledWith(
      expect.stringMatching(/Stopped at 2 \/ 100: out of turns/)
    );
  });

  it("runExploreBatch: collects reveals in reverse order onto the front of recentReveals", async () => {
    let n = 0;
    global.fetch = jest.fn(async () => {
      n++;
      return {
        ok: true,
        json: async () => ({
          success: true,
          tile: { tileId: "tile-" + n, type: "forest" },
          report: { summary: "s" + n, narrative: "narr", artifactFound: false },
        }),
      };
    }) as never;
    const { capture, refresh } = setupHook();
    await act(async () => {
      await capture.current?.runExploreBatch(3);
    });
    expect(refresh).toHaveBeenCalled();
    expect(capture.current?.recentReveals?.length).toBe(3);
    // The newest tile (tile-3) should be at the front.
    expect(capture.current?.recentReveals?.[0]?.tileId).toBe("tile-3");
  });

  it("runExploreBatch: catches fetch throw and surfaces Error message", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("net err");
    }) as never;
    const { capture, setError } = setupHook();
    await act(async () => {
      await capture.current?.runExploreBatch(3);
    });
    expect(setError).toHaveBeenCalledWith("net err");
  });

  it("runExploreBatch: falls back to 'Action failed' on non-Error throw", async () => {
    global.fetch = jest.fn(async () => {
      throw "boom";
    }) as never;
    const { capture, setError } = setupHook();
    await act(async () => {
      await capture.current?.runExploreBatch(3);
    });
    expect(setError).toHaveBeenCalledWith("Action failed");
  });

  it("runExploreBatch: skips collected reveal when response omits tile", async () => {
    let n = 0;
    global.fetch = jest.fn(async () => {
      n++;
      return {
        ok: true,
        json: async () => ({ success: true }), // no tile
      };
    }) as never;
    const { capture } = setupHook();
    await act(async () => {
      await capture.current?.runExploreBatch(2);
    });
    expect(capture.current?.recentReveals).toEqual([]);
  });
});
