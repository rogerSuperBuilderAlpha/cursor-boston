/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/attacks/page.tsx` (31.7% / 41
 * uncovered branches). Covers auth-loading + signed-out gates, all/sent/
 * received tab switch, empty list, error display, load-more flow,
 * AttackRow render for each outcome (captured / repelled / stalemate)
 * + attacker vs defender perspective.
 */

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockUseAuth = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import AttackLogPage from "@/app/game/attacks/page";

const originalFetch = global.fetch;

function setAuth(state: { user?: unknown; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    loading: state.loading ?? false,
  });
}

function mockAttacksFetch(response: Partial<Record<string, unknown>>) {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ success: true, attacks: [], ...response }),
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
    sourceTileId: "src-1",
    targetTileId: "tgt-1",
    unitsSent: { ground: 10, siege: 5, air: 2 },
    unitsLostAttacker: { ground: 1, siege: 0, air: 0 },
    unitsLostDefender: { ground: 8, siege: 4, air: 2 },
    createdAt: "2026-05-19T12:00:00Z",
    ...over,
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("AttackLogPage — gates", () => {
  it("renders spinner while auth is loading", () => {
    setAuth({ loading: true });
    const { container } = render(<AttackLogPage />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders Sign in CTA when not authenticated (after first load resolves)", async () => {
    mockAttacksFetch({});
    setAuth({ user: null });
    render(<AttackLogPage />);
    // refresh() short-circuits because no user, but setLoading(false) is called
    await waitFor(() => expect(screen.getByText("Sign in")).toBeInTheDocument());
  });
});

describe("AttackLogPage — list", () => {
  it("renders 'No attacks yet.' when list is empty", async () => {
    mockAttacksFetch({ attacks: [] });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<AttackLogPage />);
    await waitFor(() => expect(screen.getByText(/No attacks yet/)).toBeInTheDocument());
  });

  it("renders the side filter (all/sent/received)", async () => {
    mockAttacksFetch({});
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<AttackLogPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /^all$/i })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^sent$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^received$/i })).toBeInTheDocument();
  });

  it("clicking 'sent' triggers a fresh fetch", async () => {
    mockAttacksFetch({});
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<AttackLogPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    (global.fetch as jest.Mock).mockClear();
    fireEvent.click(screen.getByRole("button", { name: /^sent$/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("side=sent");
  });

  it("renders error on fetch !success with object error", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: { message: "boom" } }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<AttackLogPage />);
    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  });

  it("renders error on fetch !success with string error", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: "rate-limited" }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<AttackLogPage />);
    await waitFor(() => expect(screen.getByText("rate-limited")).toBeInTheDocument());
  });

  it("falls back to 'Failed to load' when error has no detail", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: {} }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<AttackLogPage />);
    await waitFor(() => expect(screen.getByText("Failed to load")).toBeInTheDocument());
  });

  it("renders attack rows when response has attacks", async () => {
    mockAttacksFetch({ attacks: [makeAttack({ outcome: "captured" })] });
    setAuth({ user: { uid: "u-attacker", getIdToken: async () => "tok" } });
    render(<AttackLogPage />);
    await waitFor(() => expect(screen.queryByText(/No attacks yet/)).not.toBeInTheDocument());
  });

  it("renders 'Load more' button when nextCursor is set", async () => {
    mockAttacksFetch({
      attacks: [makeAttack()],
      nextCursor: "c1",
    });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<AttackLogPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Load more/ })).toBeInTheDocument());
  });

  it("Load more invokes fetch with cursor param", async () => {
    let callCount = 0;
    global.fetch = jest.fn(async (url: string) => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          success: true,
          attacks: [makeAttack({ id: `atk-${callCount}` })],
          nextCursor: callCount === 1 ? "cursor-2" : null,
        }),
      } as never;
    }) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<AttackLogPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Load more/ })).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Load more/ }));
    });
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain("cursor=cursor-2");
  });

  it("renders 'repelled' attack outcome", async () => {
    mockAttacksFetch({ attacks: [makeAttack({ outcome: "repelled" })] });
    setAuth({ user: { uid: "u-attacker", getIdToken: async () => "tok" } });
    const { container } = render(<AttackLogPage />);
    await waitFor(() => expect(container.textContent).toMatch(/repelled/i));
  });

  it("renders 'stalemate' attack outcome", async () => {
    mockAttacksFetch({ attacks: [makeAttack({ outcome: "stalemate" })] });
    setAuth({ user: { uid: "u-attacker", getIdToken: async () => "tok" } });
    const { container } = render(<AttackLogPage />);
    await waitFor(() => expect(container.textContent).toMatch(/stalemate/i));
  });

  it("renders 'defender' perspective when user is the defender", async () => {
    mockAttacksFetch({ attacks: [makeAttack({ outcome: "repelled" })] });
    setAuth({ user: { uid: "u-defender", getIdToken: async () => "tok" } });
    render(<AttackLogPage />);
    await waitFor(() => expect(screen.queryByText(/No attacks yet/)).not.toBeInTheDocument());
  });

  it("includes limit + side query params in fetch URL", async () => {
    mockAttacksFetch({});
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<AttackLogPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("limit=20");
    expect(url).toContain("side=all");
  });
});
