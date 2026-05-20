/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/hackathons/sports-hack-2026/page.tsx`
 * (0% / 20 uncovered branches). Covers signed-out vs signed-in vs admin
 * gates, leaderboard fetch happy path with confirmed-count copy, !ok
 * fetch skip, fetch throw swallowed, user-signed-up CTA copy, rank-not-
 * null copy, registered-count fallback when data absent.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

const mockUseAuth = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/components/hackathons/LumaEmbed", () => ({
  LumaEmbed: () => <div data-testid="luma-embed" />,
}));

jest.mock("@/lib/sports-hack-2026", () => ({
  SPORTS_HACK_2026_NAME: "Sports Hack",
  SPORTS_HACK_2026_EVENT_ID: "sports-hack-2026",
  SPORTS_HACK_2026_LOCATION: "Hult",
  SPORTS_HACK_2026_LUMA_URL: "https://lu.ma/sports",
  SPORTS_HACK_2026_LUMA_EMBED_ID: "embed",
  SPORTS_HACK_2026_CAPACITY: 50,
}));

import SportsHack2026LandingPage from "@/app/hackathons/sports-hack-2026/page";

const originalFetch = global.fetch;

function setAuth(state: { user?: unknown; userProfile?: unknown } = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    userProfile: state.userProfile ?? null,
    loading: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("SportsHack2026LandingPage", () => {
  it("renders the landing page when signed out (no leaderboard data)", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })) as never;
    setAuth();
    render(<SportsHack2026LandingPage />);
    expect(screen.getAllByText(/Sports Hack/).length).toBeGreaterThan(0);
    expect(screen.getByText(/50 confirmed seats/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Register on the website/i })).toBeInTheDocument();
  });

  it("fetches leaderboard and renders confirmed-count copy on success", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        totalCount: 60,
        websiteSignupCount: 40,
        entries: [
          { rank: 1, status: "confirmed", creditEligible: true },
          { rank: 2, status: "confirmed", creditEligible: true },
          { rank: 3, status: "waitlisted", creditEligible: false },
        ],
        creditTopN: 50,
        me: null,
      }),
    })) as never;
    setAuth();
    render(<SportsHack2026LandingPage />);
    await waitFor(() => expect(screen.getByText(/2\/50 confirmed · 60 registered/)).toBeInTheDocument());
  });

  it("falls back to creditEligible when entry.status is undefined", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        totalCount: 10,
        entries: [
          { rank: 1, creditEligible: true }, // → confirmed via fallback
          { rank: 2, creditEligible: false }, // → waitlisted via fallback
        ],
        creditTopN: 50,
      }),
    })) as never;
    setAuth();
    render(<SportsHack2026LandingPage />);
    await waitFor(() => expect(screen.getByText(/1\/50 confirmed · 10 registered/)).toBeInTheDocument());
  });

  it("renders signed-up CTA with rank when user is in leaderboard", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        totalCount: 10,
        entries: [],
        creditTopN: 50,
        me: { signedUp: true, rank: 7 },
      }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<SportsHack2026LandingPage />);
    await waitFor(() => expect(screen.getByText(/rank #7/)).toBeInTheDocument());
  });

  it("renders signed-up CTA without rank when rank is null", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        totalCount: 10,
        entries: [],
        creditTopN: 50,
        me: { signedUp: true, rank: null },
      }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<SportsHack2026LandingPage />);
    await waitFor(() => expect(screen.getByText(/You're signed up · Manage/)).toBeInTheDocument());
  });

  it("renders admin link when userProfile.isAdmin=true", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })) as never;
    setAuth({
      user: { uid: "u1", getIdToken: async () => "tok" },
      userProfile: { isAdmin: true },
    });
    render(<SportsHack2026LandingPage />);
    expect(screen.getByRole("link", { name: /Admin check-in/ })).toBeInTheDocument();
  });

  it("does NOT render admin link for non-admin signed-in user", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" }, userProfile: { isAdmin: false } });
    render(<SportsHack2026LandingPage />);
    expect(screen.queryByRole("link", { name: /Admin check-in/ })).not.toBeInTheDocument();
  });

  it("swallows fetch errors and still renders the page", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as never;
    setAuth();
    render(<SportsHack2026LandingPage />);
    expect(screen.getAllByText(/Sports Hack/).length).toBeGreaterThan(0);
  });

  it("includes Authorization header when signed in", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<SportsHack2026LandingPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const args = (global.fetch as jest.Mock).mock.calls[0];
    expect(args[1].headers.Authorization).toBe("Bearer tok");
  });

  it("does NOT include Authorization header when signed out", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })) as never;
    setAuth();
    render(<SportsHack2026LandingPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const args = (global.fetch as jest.Mock).mock.calls[0];
    expect(args[1].headers.Authorization).toBeUndefined();
  });
});
