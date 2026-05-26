/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment jsdom
 */

import { useEffect  } from "react";
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
  onCapture,
}: {
  user: { getIdToken: () => Promise<string> } | null;
  setError: (m: string | null) => void;
  refresh: () => Promise<void>;
  onCapture: (hook: Hook) => void;
}) {
  const hook = useSetupActions({ user: user as never, setError, refresh });

  useEffect(() => {
    onCapture(hook);
  }, [hook, onCapture]);

  return null;
}

function setupHook(
  user: { getIdToken: () => Promise<string> } | null = {
    getIdToken: async () => "tok",
  }
) {
  let currentHook: Hook | null = null;
  const setError = jest.fn();
  const refresh = jest.fn(async () => undefined);
  const onCapture = (hook: Hook) => {
    currentHook = hook;
  };

  render(
    <Probe
      user={user}
      setError={setError}
      refresh={refresh}
      onCapture={onCapture}
    />
  );

  return {
    getHook: () => currentHook,
    setError,
    refresh,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useSetupActions", () => {
  it("returns initial state busy=false, no batch progress, empty reveals", () => {
    const { getHook } = setupHook(null);
    expect(getHook()?.busy).toBe(false);
    expect(getHook()?.batchProgress).toBeNull();
    expect(getHook()?.recentReveals).toEqual([]);
  });

  it("callApi: no-op when user is null", async () => {
    const { getHook, refresh, setError } = setupHook(null);
    await act(async () => {
      await getHook()?.callApi("/api/x");
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
    const { getHook, refresh, setError } = setupHook();
    await act(async () => {
      await getHook()?.callApi("/api/x", { foo: 1 });
    });
    expect(refresh).toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(null);
  });

  it("callApi: surfaces data.error.message on { success: false, error: { message } }", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: { message: "rate-limited" } }),
    })) as never;
    const { getHook, setError, refresh } = setupHook();
    await act(async () => {
      await getHook()?.callApi("/api/x");
    });
    expect(setError).toHaveBeenCalledWith("rate-limited");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("callApi: surfaces data.error string when error is a string", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: "bad input" }),
    })) as never;
    const { getHook, setError } = setupHook();
    await act(async () => {
      await getHook()?.callApi("/api/x");
    });
    expect(setError).toHaveBeenCalledWith("bad input");
  });

  it("callApi: falls back to 'Action failed' when no message is provided", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false }),
    })) as never;
    const { getHook, setError } = setupHook();
    await act(async () => {
      await getHook()?.callApi("/api/x");
    });
    expect(setError).toHaveBeenCalledWith("Action failed");
  });

  it("callApi: catches fetch throw and surfaces Error message", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as never;
    const { getHook, setError } = setupHook();
    await act(async () => {
      await getHook()?.callApi("/api/x");
    });
    expect(setError).toHaveBeenCalledWith("network down");
  });

  it("callApi: falls back to 'Action failed' on non-Error throw", async () => {
    global.fetch = jest.fn(async () => {
      throw "string-error";
    }) as never;
    const { getHook, setError } = setupHook();
    await act(async () => {
      await getHook()?.callApi("/api/x");
    });
    expect(setError).toHaveBeenCalledWith("Action failed");
  });

  it("runExploreBatch: no-op when user is null", async () => {
    const { getHook, refresh } = setupHook(null);
    await act(async () => {
      await getHook()?.runExploreBatch(3);
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
    const { getHook } = setupHook();
    await act(async () => {
      await getHook()?.runExploreBatch(0);
    });
    expect(calls.length).toBe(1);
  });

  it("runExploreBatch: clamps batch count above 100 (and stops on first failure)", async () => {
    let n = 0;
    global.fetch = jest.fn(async () => {
      n++;
      return {
        ok: true,
        json: async () =>
          n < 3
            ? {
                success: true,
                tile: { tileId: "t" + n, type: "forest" },
                report: { summary: "ok" },
              }
            : { success: false, error: "out of turns" },
      };
    }) as never;
    const { getHook, setError } = setupHook();
    await act(async () => {
      await getHook()?.runExploreBatch(200);
    });
    expect(setError).toHaveBeenCalledWith(
      expect.stringMatching(/Stopped at 2 \/ 100: out of turns/)
    );
  });

  it("runExploreBatch: collects reveals in reverse order at the front", async () => {
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
    const { getHook, refresh } = setupHook();
    await act(async () => {
      await getHook()?.runExploreBatch(3);
    });
    expect(refresh).toHaveBeenCalled();
    expect(getHook()?.recentReveals?.length).toBe(3);
    expect(getHook()?.recentReveals?.[0]?.tileId).toBe("tile-3");
  });

  it("runExploreBatch: catches fetch throw and surfaces Error message", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("net err");
    }) as never;
    const { getHook, setError } = setupHook();
    await act(async () => {
      await getHook()?.runExploreBatch(3);
    });
    expect(setError).toHaveBeenCalledWith("net err");
  });

  it("runExploreBatch: falls back to 'Action failed' on non-Error throw", async () => {
    global.fetch = jest.fn(async () => {
      throw "boom";
    }) as never;
    const { getHook, setError } = setupHook();
    await act(async () => {
      await getHook()?.runExploreBatch(3);
    });
    expect(setError).toHaveBeenCalledWith("Action failed");
  });

  it("runExploreBatch: skips collected reveal when response omits tile", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    })) as never;
    const { getHook } = setupHook();
    await act(async () => {
      await getHook()?.runExploreBatch(2);
    });
    expect(getHook()?.recentReveals).toEqual([]);
  });
});
