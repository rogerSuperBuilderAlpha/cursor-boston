/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/attacks/[attackId]/page.tsx`
 * (0% / 51 uncovered branches). Covers auth-loading + signed-out gates,
 * load happy path (attacker victory / attacker loss → autopsy /
 * defender victory), data.error string vs object vs missing → HTTP
 * fallback, fetch throw fallback, no-snapshot defender section, missing
 * unitsOnTargetPreAttack skips autopsy, autopsy=0 outcomes show "no
 * autopsy available" copy, outcomeFlipped icon branches.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

jest.mock("react", () => {
  const actual = jest.requireActual<typeof import("react")>("react");
  return {
    ...actual,
    use<T>(usable: Promise<T> | T): T {
      const resolved = (usable as Promise<T> & { __testResolvedValue?: T })
        ?.__testResolvedValue;
      if (resolved !== undefined) return resolved;
      if (typeof actual.use === "function") {
        return actual.use(usable as never);
      }
      return usable as T;
    },
  };
});

const mockUseAuth = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockResolveAttack = jest.fn();
const mockRng = jest.fn();
jest.mock("@/lib/game/combat", () => ({
  resolveAttack: (...args: unknown[]) => mockResolveAttack(...args),
  makeSeededRng: (...args: unknown[]) => mockRng(...args),
}));

let autopsyMockResult: unknown[] = [];
jest.mock("@/lib/game/zero-turn", () => ({
  defaultLossPerturbations: jest.fn(() => []),
  runAutopsy: jest.fn(() => autopsyMockResult),
}));

import BattleAutopsyPage from "@/app/game/attacks/[attackId]/page";

const originalFetch = global.fetch;

function setAuth(state: { user?: unknown; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    loading: state.loading ?? false,
  });
}

function mockFetch(response: unknown, ok = true) {
  global.fetch = jest.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => response,
  })) as never;
}

function makeAttack(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "atk-1",
    attackerId: "u-attacker",
    defenderId: "u-defender",
    outcome: "captured",
    casteAttacker: "red",
    casteDefender: "blue",
    unitsSent: { ground: 10, siege: 5, air: 3 },
    unitsLostAttacker: { ground: 1, siege: 0, air: 0 },
    unitsLostDefender: { ground: 8, siege: 4, air: 2 },
    unitsOnTargetPreAttack: { ground: 8, siege: 4, air: 2 },
    rngSeed: "seed-1",
    offenseSpellId: null,
    defenseSpellId: null,
    ...over,
  };
}

function params(attackId: string) {
  const p = Promise.resolve({ attackId }) as Promise<{ attackId: string }> & {
    __testResolvedValue?: { attackId: string };
  };
  p.__testResolvedValue = { attackId };
  return p;
}

beforeEach(() => {
  jest.clearAllMocks();
  autopsyMockResult = [];
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("BattleAutopsyPage — gates", () => {
  it("renders 'Loading…' while auth is loading", () => {
    setAuth({ loading: true });
    render(<BattleAutopsyPage params={params("atk-1")} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders 'Loading…' when no user (loading state stays true since load() is gated)", () => {
    setAuth({ user: null });
    render(<BattleAutopsyPage params={params("atk-1")} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});

describe("BattleAutopsyPage — load", () => {
  it("renders attacker-victory ('captured' outcome) without autopsy", async () => {
    mockFetch({ success: true, attack: makeAttack({ outcome: "captured" }) });
    setAuth({ user: { uid: "u-attacker", getIdToken: async () => "tok" } });
    render(<BattleAutopsyPage params={params("atk-1")} />);
    await waitFor(() => expect(screen.getByText(/Battle autopsy/)).toBeInTheDocument());
    expect(screen.getByText(/You victory.*as attacker/)).toBeInTheDocument();
  });

  it("renders attacker-loss with autopsy outcomes (flipped + not flipped)", async () => {
    autopsyMockResult = [
      { outcomeFlipped: true, summary: "+5 ground → captured" },
      { outcomeFlipped: false, summary: "+1 siege → still failed" },
    ];
    mockFetch({
      success: true,
      attack: makeAttack({ outcome: "repelled" }),
    });
    setAuth({ user: { uid: "u-attacker", getIdToken: async () => "tok" } });
    render(<BattleAutopsyPage params={params("atk-1")} />);
    await waitFor(() => expect(screen.getByText(/What if you had brought more/)).toBeInTheDocument());
    expect(screen.getByText(/\+5 ground/)).toBeInTheDocument();
    expect(screen.getByText(/\+1 siege/)).toBeInTheDocument();
  });

  it("renders defender-victory (attack repelled, viewer is defender)", async () => {
    mockFetch({
      success: true,
      attack: makeAttack({ outcome: "repelled" }),
    });
    setAuth({ user: { uid: "u-defender", getIdToken: async () => "tok" } });
    render(<BattleAutopsyPage params={params("atk-1")} />);
    await waitFor(() => expect(screen.getByText(/You victory.*as defender/)).toBeInTheDocument());
    expect(screen.getByText(/Autopsy counterfactuals run for losses/)).toBeInTheDocument();
  });

  it("renders 'No snapshot' message when unitsOnTargetPreAttack is absent", async () => {
    mockFetch({
      success: true,
      attack: makeAttack({
        outcome: "captured",
        unitsOnTargetPreAttack: undefined,
      }),
    });
    setAuth({ user: { uid: "u-attacker", getIdToken: async () => "tok" } });
    render(<BattleAutopsyPage params={params("atk-1")} />);
    await waitFor(() => expect(screen.getByText(/No snapshot/)).toBeInTheDocument());
  });

  it("renders 'No autopsy available' when attacker lost but no pre-attack snapshot", async () => {
    mockFetch({
      success: true,
      attack: makeAttack({
        outcome: "repelled",
        unitsOnTargetPreAttack: undefined,
      }),
    });
    setAuth({ user: { uid: "u-attacker", getIdToken: async () => "tok" } });
    render(<BattleAutopsyPage params={params("atk-1")} />);
    await waitFor(() => expect(screen.getByText(/No autopsy available/)).toBeInTheDocument());
  });
});

describe("BattleAutopsyPage — errors", () => {
  it("surfaces data.error string when success=false", async () => {
    mockFetch({ success: false, error: "not your attack" });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<BattleAutopsyPage params={params("atk-1")} />);
    await waitFor(() => expect(screen.getByText(/not your attack/)).toBeInTheDocument());
  });

  it("surfaces data.error.message when error is an object", async () => {
    mockFetch({ success: false, error: { message: "rate-limited" } });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<BattleAutopsyPage params={params("atk-1")} />);
    await waitFor(() => expect(screen.getByText(/rate-limited/)).toBeInTheDocument());
  });

  it("falls back to 'HTTP <status>' when error is missing", async () => {
    mockFetch({ success: false }, false);
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<BattleAutopsyPage params={params("atk-1")} />);
    await waitFor(() => expect(screen.getByText(/HTTP 500/)).toBeInTheDocument());
  });

  it("surfaces fetch throw Error message", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<BattleAutopsyPage params={params("atk-1")} />);
    await waitFor(() => expect(screen.getByText(/network down/)).toBeInTheDocument());
  });

  it("falls back to 'Failed to load' on non-Error throw", async () => {
    global.fetch = jest.fn(async () => {
      throw "string-error";
    }) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<BattleAutopsyPage params={params("atk-1")} />);
    await waitFor(() => expect(screen.getByText(/Failed to load/)).toBeInTheDocument());
  });
});
