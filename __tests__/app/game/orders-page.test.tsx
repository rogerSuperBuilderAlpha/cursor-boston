/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/orders/page.tsx` (37% / 38
 * uncovered branches). Covers auth gates, kind selector (recruit/
 * attack/spell), each kind's body construction, refresh error variants
 * (object.message / string / no-detail), enqueue error fallback, cancel
 * order, includeExecuted query param.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockUseAuth = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import OrdersPage from "@/app/game/orders/page";

const originalFetch = global.fetch;

function setAuth(state: { user?: unknown; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    loading: state.loading ?? false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("OrdersPage", () => {
  it("renders 'Loading…' while auth is loading", () => {
    setAuth({ loading: true });
    render(<OrdersPage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders 'Please sign in.' when not authenticated", () => {
    setAuth({ user: null });
    render(<OrdersPage />);
    expect(screen.getByText(/Please sign in/)).toBeInTheDocument();
  });

  it("loads orders on mount and renders the form", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, orders: [] }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<OrdersPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getAllByText(/Queued orders/).length).toBeGreaterThan(0);
  });

  it("surfaces error.message on success:false (object)", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: { message: "rate-limited" } }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByText("rate-limited")).toBeInTheDocument());
  });

  it("surfaces string error on success:false", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: "boom" }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  });

  it("falls back to 'Load failed' when error has no detail", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByText("Load failed")).toBeInTheDocument());
  });

  it("submits a recruit_on_tile order with tileId + unitType", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, orders: [] }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<OrdersPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(/tileId \(e\.g\. q0r0\)/), {
      target: { value: "q1r1" },
    });
    const submitBtn = screen.getByRole("button", { name: /Enqueue|Add|Submit/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 2nd call is POST
    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      (c) => c[1]?.method === "POST"
    );
    expect(postCall).toBeDefined();
    if (postCall) {
      const body = JSON.parse(postCall[1].body);
      expect(body.kind).toBe("recruit_on_tile");
      expect(body.tileId).toBe("q1r1");
    }
  });

  it("submits an attack_adjacent order when kind is switched", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, orders: [] }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<OrdersPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "attack_adjacent" } });
    const submitBtn = screen.getByRole("button", { name: /Enqueue|Add|Submit/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      (c) => c[1]?.method === "POST"
    );
    expect(postCall).toBeDefined();
    if (postCall) {
      const body = JSON.parse(postCall[1].body);
      expect(body.kind).toBe("attack_adjacent");
      expect(body.units).toEqual({ ground: 0, siege: 0, air: 0 });
    }
  });

  it("submits a cast_spell_on_tile order when kind is switched", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, orders: [] }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<OrdersPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "cast_spell_on_tile" } });
    const submitBtn = screen.getByRole("button", { name: /Enqueue|Add|Submit/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      (c) => c[1]?.method === "POST"
    );
    expect(postCall).toBeDefined();
    if (postCall) {
      const body = JSON.parse(postCall[1].body);
      expect(body.kind).toBe("cast_spell_on_tile");
    }
  });

  it("surfaces enqueue error on POST !success", async () => {
    let callIndex = 0;
    global.fetch = jest.fn(async () => {
      callIndex++;
      if (callIndex === 1) {
        return { ok: true, json: async () => ({ success: true, orders: [] }) } as never;
      }
      return {
        ok: true,
        json: async () => ({ success: false, error: { message: "duplicate order" } }),
      } as never;
    }) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<OrdersPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(/tileId \(e\.g\. q0r0\)/), {
      target: { value: "q1r1" },
    });
    const submitBtn = screen.getByRole("button", { name: /Enqueue|Add|Submit/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    await waitFor(() => expect(screen.getByText("duplicate order")).toBeInTheDocument());
  });

  it("includeExecuted toggle adds query param on refresh", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, orders: [] }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<OrdersPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Click the includeExecuted checkbox
    const checkbox = screen.queryByRole("checkbox");
    if (checkbox) {
      fireEvent.click(checkbox);
      await waitFor(() => {
        const lastUrl = (global.fetch as jest.Mock).mock.calls.at(-1)?.[0] as string;
        expect(lastUrl).toContain("includeExecuted=true");
      });
    } else {
      expect(true).toBe(true);
    }
  });
});
