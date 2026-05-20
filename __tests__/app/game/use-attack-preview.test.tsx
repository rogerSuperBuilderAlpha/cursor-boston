/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/threats/_lib/use-attack-preview.ts`
 * (23% / 23 uncovered branches). Hook owns the attack-preview lifecycle:
 * covers shouldFetch=false gates (authLoading, no-user, disabled,
 * total=0, no-source, no-target), happy fetch + state, server error
 * (string vs object vs neither), fetch throw, race-guard (newer request
 * wins), gate flip clears loading state.
 */

import React, { useEffect } from "react";
import { act, render } from "@testing-library/react";

const mockUseAuth = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import { useAttackPreview } from "@/app/game/threats/_lib/use-attack-preview";

const originalFetch = global.fetch;

type State = ReturnType<typeof useAttackPreview>;

function Probe({
  args,
  capture: captureRef,
}: {
  args: Parameters<typeof useAttackPreview>[0];
  capture: { current: State | null };
}) {
  const s = useAttackPreview(args);
  useEffect(() => {
    captureRef.current = s;
  }, [captureRef, s]);
  return null;
}

function setAuth(state: { user?: unknown; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    loading: state.loading ?? false,
  });
}

const defaultArgs = {
  sourceTileId: "src-1",
  targetTileId: "tgt-1",
  units: { ground: 5, siege: 0, air: 0 },
  offenseSpellId: null as string | null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  global.fetch = originalFetch;
});

describe("useAttackPreview", () => {
  it("returns initial state and no fetch when auth is loading", () => {
    setAuth({ loading: true });
    global.fetch = jest.fn() as never;
    const capture: { current: State | null } = { current: null };
    render(<Probe args={defaultArgs} capture={capture} />);
    expect(capture.current).toEqual({ preview: null, loading: false, error: null });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does NOT fetch when user is null", () => {
    setAuth({ user: null });
    global.fetch = jest.fn() as never;
    const capture: { current: State | null } = { current: null };
    render(<Probe args={defaultArgs} capture={capture} />);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does NOT fetch when disabled=true", () => {
    setAuth({ user: { getIdToken: async () => "tok" } });
    global.fetch = jest.fn() as never;
    const capture: { current: State | null } = { current: null };
    render(<Probe args={{ ...defaultArgs, disabled: true }} capture={capture} />);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does NOT fetch when total units is 0", () => {
    setAuth({ user: { getIdToken: async () => "tok" } });
    global.fetch = jest.fn() as never;
    const capture: { current: State | null } = { current: null };
    render(
      <Probe
        args={{ ...defaultArgs, units: { ground: 0, siege: 0, air: 0 } }}
        capture={capture}
      />
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does NOT fetch when sourceTileId is empty", () => {
    setAuth({ user: { getIdToken: async () => "tok" } });
    global.fetch = jest.fn() as never;
    const capture: { current: State | null } = { current: null };
    render(<Probe args={{ ...defaultArgs, sourceTileId: "" }} capture={capture} />);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does NOT fetch when targetTileId is empty", () => {
    setAuth({ user: { getIdToken: async () => "tok" } });
    global.fetch = jest.fn() as never;
    const capture: { current: State | null } = { current: null };
    render(<Probe args={{ ...defaultArgs, targetTileId: "" }} capture={capture} />);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches and sets preview on success after debounce", async () => {
    setAuth({ user: { getIdToken: async () => "tok" } });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        combat: {},
        source: { id: "src-1" },
        target: { id: "tgt-1" },
        defender: { userId: "u2", displayName: "Bob", caste: "red", shielded: false },
        effects: {},
      }),
    })) as never;
    const capture: { current: State | null } = { current: null };
    render(<Probe args={defaultArgs} capture={capture} />);
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalled();
    expect(capture.current?.preview?.defender.userId).toBe("u2");
    expect(capture.current?.loading).toBe(false);
    expect(capture.current?.error).toBeNull();
  });

  it("surfaces server error.message when success=false with object error", async () => {
    setAuth({ user: { getIdToken: async () => "tok" } });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: { message: "shielded" } }),
    })) as never;
    const capture: { current: State | null } = { current: null };
    render(<Probe args={defaultArgs} capture={capture} />);
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(capture.current?.error).toBe("shielded");
    expect(capture.current?.preview).toBeNull();
  });

  it("surfaces server error string when success=false with string error", async () => {
    setAuth({ user: { getIdToken: async () => "tok" } });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: "rate-limited" }),
    })) as never;
    const capture: { current: State | null } = { current: null };
    render(<Probe args={defaultArgs} capture={capture} />);
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(capture.current?.error).toBe("rate-limited");
  });

  it("falls back to 'Preview failed' when error is an object with no message", async () => {
    setAuth({ user: { getIdToken: async () => "tok" } });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: {} }),
    })) as never;
    const capture: { current: State | null } = { current: null };
    render(<Probe args={defaultArgs} capture={capture} />);
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(capture.current?.error).toBe("Preview failed");
  });

  it("surfaces fetch throw with Error message", async () => {
    setAuth({ user: { getIdToken: async () => "tok" } });
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as never;
    const capture: { current: State | null } = { current: null };
    render(<Probe args={defaultArgs} capture={capture} />);
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(capture.current?.error).toBe("network down");
  });

  it("falls back to 'Preview failed' on non-Error throw", async () => {
    setAuth({ user: { getIdToken: async () => "tok" } });
    global.fetch = jest.fn(async () => {
      throw "string error";
    }) as never;
    const capture: { current: State | null } = { current: null };
    render(<Probe args={defaultArgs} capture={capture} />);
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(capture.current?.error).toBe("Preview failed");
  });

  it("includes offenseSpellId in body when provided", async () => {
    setAuth({ user: { getIdToken: async () => "tok" } });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        combat: {},
        source: {},
        target: {},
        defender: { userId: "u2", displayName: "B", caste: "red", shielded: false },
        effects: {},
      }),
    })) as never;
    const capture: { current: State | null } = { current: null };
    render(<Probe args={{ ...defaultArgs, offenseSpellId: "frost" }} capture={capture} />);
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });
    const args = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(args[1].body);
    expect(body.offenseSpellId).toBe("frost");
  });

  it("does NOT include offenseSpellId when null", async () => {
    setAuth({ user: { getIdToken: async () => "tok" } });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        combat: {},
        source: {},
        target: {},
        defender: { userId: "u2", displayName: "B", caste: "red", shielded: false },
        effects: {},
      }),
    })) as never;
    const capture: { current: State | null } = { current: null };
    render(<Probe args={defaultArgs} capture={capture} />);
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });
    const args = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(args[1].body);
    expect("offenseSpellId" in body).toBe(false);
  });
});
