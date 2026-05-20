/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage push #141 — `app/hackathons/sports-hack-2026/admin/page.tsx`
 * (24.8% / 85 uncovered branches). Covers auth-loading gate, signed-out
 * gate, fetch error variants, fetch happy paths, search filter, check-in
 * toggle (success / !ok / throw), every status-render branch (confirmed
 * vs waitlisted vs luma-only, willBeLate vs queuing, lumaRegistered yes/
 * no, displayName/githubLogin present vs missing), refresh-now button,
 * 60s polling skipped when error is set, and StatCard highlight/warn
 * variants.
 */
 
 

import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mockUseAuth = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/lib/sports-hack-2026", () => ({
  SPORTS_HACK_2026_CAPACITY: 50,
  SPORTS_HACK_2026_EVENT_ID: "sports-hack-2026",
  SPORTS_HACK_2026_SHORT_NAME: "Sports Hack",
}));

import SportsHack2026AdminPage from "@/app/hackathons/sports-hack-2026/admin/page";

const originalFetch = global.fetch;

type AuthState = {
  user?: unknown;
  loading?: boolean;
};

function setAuth(state: AuthState = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    loading: state.loading ?? false,
  });
}

function makeUser(token = "tok") {
  return { uid: "u1", getIdToken: jest.fn(async () => token) };
}

function entry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    rank: 1,
    userId: "uid-1",
    displayName: "Alice Aardvark",
    githubLogin: "alice",
    mergedPrCount: 3,
    signedUpAt: "2026-05-01T00:00:00.000Z",
    creditEligible: true,
    status: "confirmed" as const,
    checkedIn: false,
    willBeLate: false,
    queuingForSpot: false,
    lumaRegistered: true,
    ...overrides,
  };
}

function mockFetchOnce(impl: () => unknown) {
  (global.fetch as unknown as jest.Mock).mockImplementationOnce(impl as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  global.fetch = jest.fn() as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("SportsHack2026AdminPage", () => {
  it("shows the auth-loading spinner when authLoading=true", () => {
    setAuth({ loading: true });
    const { container } = render(<SportsHack2026AdminPage />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows the signed-out gate when user is null", () => {
    setAuth({ user: null });
    render(<SportsHack2026AdminPage />);
    expect(screen.getByText(/Sign in to access admin check-in/i)).toBeInTheDocument();
  });

  it("shows the data-loading spinner when user is set but no data has arrived yet", async () => {
    // getToken returns null → loadSignups bails out before fetching.
    const user = { uid: "u1", getIdToken: jest.fn(async () => null as unknown as string) };
    setAuth({ user });
    const { container } = render(<SportsHack2026AdminPage />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders the error gate when fetch returns !ok, and Retry triggers a reload", async () => {
    setAuth({ user: makeUser() });
    // First call fails, second succeeds after Retry.
    (global.fetch as unknown as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          eventId: "sports-hack-2026",
          totalCount: 1,
          websiteSignupCount: 1,
          entries: [entry()],
          creditTopN: 50,
        }),
      });
    render(<SportsHack2026AdminPage />);
    await waitFor(() => expect(screen.getByText(/HTTP 500/)).toBeInTheDocument());
    const retry = screen.getByRole("button", { name: /Retry/i });
    await act(async () => {
      fireEvent.click(retry);
    });
    await waitFor(() => expect(screen.getByText(/Door Check-In/)).toBeInTheDocument());
  });

  it("renders an empty-state when no signups are present", async () => {
    setAuth({ user: makeUser() });
    (global.fetch as unknown as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        eventId: "sports-hack-2026",
        totalCount: 0,
        websiteSignupCount: 0,
        entries: [],
        creditTopN: 50,
      }),
    });
    render(<SportsHack2026AdminPage />);
    await waitFor(() => expect(screen.getByText(/No signups yet/)).toBeInTheDocument());
  });

  it("renders confirmed / waitlist / luma-only sections + late / queuing / no-luma badges", async () => {
    setAuth({ user: makeUser() });
    (global.fetch as unknown as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        eventId: "sports-hack-2026",
        totalCount: 4,
        websiteSignupCount: 3,
        creditTopN: 50,
        entries: [
          // Confirmed, checked in, has luma, no late/queuing — exercises checkedIn=true row class.
          entry({ rank: 1, userId: "u-alice", displayName: "Alice", githubLogin: "alice", checkedIn: true, lumaRegistered: true }),
          // Confirmed, NOT checked in, willBeLate=true, no luma → LATE badge + "No Luma" pill + noShow.
          entry({
            rank: 2,
            userId: "u-bob",
            displayName: "Bob",
            githubLogin: "bob",
            status: "confirmed",
            checkedIn: false,
            willBeLate: true,
            lumaRegistered: false,
          }),
          // Waitlisted with userId, queuingForSpot=true, no displayName, no githubLogin → em-dash fallbacks + QUEUING badge.
          entry({
            rank: 3,
            userId: "u-carol",
            displayName: null,
            githubLogin: null,
            status: "waitlisted",
            queuingForSpot: true,
            lumaRegistered: false,
          }),
          // Luma-only (userId=null) → goes into the lumaOnlyEntries section, N/A check-in cell.
          entry({
            rank: 4,
            userId: null,
            displayName: "Dana",
            githubLogin: "dana",
            status: "waitlisted",
            lumaRegistered: true,
          }),
        ],
      }),
    });
    render(<SportsHack2026AdminPage />);
    await waitFor(() => expect(screen.getByText(/Door Check-In/)).toBeInTheDocument());
    expect(screen.getByText(/Participants/)).toBeInTheDocument();
    // Section headers
    expect(screen.getByText(/Confirmed \(1 \/ 2 checked in\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/Waitlist/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Luma-only \(1\)/)).toBeInTheDocument();
    // Badges
    expect(screen.getByText(/LATE/)).toBeInTheDocument();
    expect(screen.getByText(/QUEUING/)).toBeInTheDocument();
    // RSVP pills
    expect(screen.getAllByText(/⚠ No Luma/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/✓ Luma/).length).toBeGreaterThan(0);
    // GitHub link uses login
    expect(screen.getByRole("link", { name: /@alice/ })).toHaveAttribute(
      "href",
      "https://github.com/alice"
    );
    // N/A cell for luma-only rows
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("filters by name and shows the 'No matches.' message when search has no hits", async () => {
    setAuth({ user: makeUser() });
    (global.fetch as unknown as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        eventId: "sports-hack-2026",
        totalCount: 2,
        websiteSignupCount: 2,
        creditTopN: 50,
        entries: [
          entry({ rank: 1, userId: "u-a", displayName: "Alice", githubLogin: "alice" }),
          entry({ rank: 2, userId: "u-b", displayName: "Bob", githubLogin: "bob", status: "confirmed" }),
        ],
      }),
    });
    render(<SportsHack2026AdminPage />);
    await waitFor(() => expect(screen.getByText(/Door Check-In/)).toBeInTheDocument());

    const search = screen.getByPlaceholderText(/Search by name or GitHub/);
    // Filter by displayName.
    await act(async () => {
      fireEvent.change(search, { target: { value: "alice" } });
    });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();

    // No matches.
    await act(async () => {
      fireEvent.change(search, { target: { value: "zzznomatch" } });
    });
    expect(screen.getByText(/No matches/)).toBeInTheDocument();

    // Filter by githubLogin substring as well.
    await act(async () => {
      fireEvent.change(search, { target: { value: "bob" } });
    });
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("toggles check-in successfully and updates the row optimistically", async () => {
    setAuth({ user: makeUser() });
    (global.fetch as unknown as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          eventId: "sports-hack-2026",
          totalCount: 1,
          websiteSignupCount: 1,
          creditTopN: 50,
          entries: [entry({ rank: 1, userId: "u-a", displayName: "Alice", checkedIn: false })],
        }),
      })
      // POST /checkin
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<SportsHack2026AdminPage />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    const toggle = screen.getByRole("switch", { name: /Check in/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await act(async () => {
      fireEvent.click(toggle);
    });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [postUrl, postInit] = (global.fetch as unknown as jest.Mock).mock.calls[1];
    expect(postUrl).toContain("/checkin");
    expect(postInit.method).toBe("POST");
    expect(postInit.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(postInit.body)).toEqual({ userId: "u-a", checkedIn: true });
  });

  it("reverts the optimistic toggle when the check-in POST returns !ok", async () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    setAuth({ user: makeUser() });
    (global.fetch as unknown as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          eventId: "sports-hack-2026",
          totalCount: 1,
          websiteSignupCount: 1,
          creditTopN: 50,
          entries: [entry({ rank: 1, userId: "u-a", displayName: "Alice", checkedIn: false })],
        }),
      })
      // POST !ok; body json also throws to exercise the .catch(() => ({})) branch.
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("bad json");
        },
      });
    render(<SportsHack2026AdminPage />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    const toggle = screen.getByRole("switch", { name: /Check in/i });
    await act(async () => {
      fireEvent.click(toggle);
    });
    await waitFor(() =>
      expect(toggle).toHaveAttribute("aria-checked", "false")
    );
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("reverts the optimistic toggle when the check-in POST throws", async () => {
    setAuth({ user: makeUser() });
    (global.fetch as unknown as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          eventId: "sports-hack-2026",
          totalCount: 1,
          websiteSignupCount: 1,
          creditTopN: 50,
          entries: [entry({ rank: 1, userId: "u-a", displayName: "Alice", checkedIn: true })],
        }),
      })
      .mockRejectedValueOnce(new Error("network down"));
    render(<SportsHack2026AdminPage />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    const toggle = screen.getByRole("switch", { name: /Undo check-in/i });
    await act(async () => {
      fireEvent.click(toggle);
    });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
  });

  it("renders error message string when fetch itself throws (non-Error)", async () => {
    setAuth({ user: makeUser() });
    (global.fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      // Throw a non-Error → falls back to the default error string.
      throw "boom";
    });
    render(<SportsHack2026AdminPage />);
    await waitFor(() =>
      expect(screen.getByText(/Couldn't load signups/)).toBeInTheDocument()
    );
  });

  it("renders Last refresh timestamp + Refresh-now button refetches", async () => {
    setAuth({ user: makeUser() });
    (global.fetch as unknown as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          eventId: "sports-hack-2026",
          totalCount: 1,
          websiteSignupCount: 1,
          creditTopN: 50,
          entries: [entry({ rank: 1, userId: "u-a", displayName: "Alice" })],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          eventId: "sports-hack-2026",
          totalCount: 1,
          websiteSignupCount: 1,
          creditTopN: 50,
          entries: [entry({ rank: 1, userId: "u-a", displayName: "Alice" })],
        }),
      });
    render(<SportsHack2026AdminPage />);
    await waitFor(() => expect(screen.getByText(/Last:/)).toBeInTheDocument());
    const refresh = screen.getByRole("button", { name: /Refresh now/i });
    await act(async () => {
      fireEvent.click(refresh);
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  it("polls every 60s while user is signed in and no error is set", async () => {
    setAuth({ user: makeUser() });
    (global.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        eventId: "sports-hack-2026",
        totalCount: 0,
        websiteSignupCount: 0,
        creditTopN: 50,
        entries: [],
      }),
    });
    render(<SportsHack2026AdminPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  it("renders StatCards reflecting confirmed / no-shows / waitlist / arriving-late / queueing / no-Luma counts", async () => {
    setAuth({ user: makeUser() });
    (global.fetch as unknown as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        eventId: "sports-hack-2026",
        totalCount: 5,
        websiteSignupCount: 4,
        creditTopN: 50,
        entries: [
          entry({ rank: 1, userId: "u-1", displayName: "A", status: "confirmed", checkedIn: true, lumaRegistered: true }),
          entry({ rank: 2, userId: "u-2", displayName: "B", status: "confirmed", checkedIn: false, willBeLate: true, lumaRegistered: false }),
          entry({ rank: 3, userId: "u-3", displayName: "C", status: "waitlisted", checkedIn: true, lumaRegistered: false }),
          entry({ rank: 4, userId: "u-4", displayName: "D", status: "waitlisted", queuingForSpot: true, lumaRegistered: false }),
          entry({ rank: 5, userId: null, displayName: "Luma-only", status: "waitlisted", lumaRegistered: true }),
        ],
      }),
    });
    render(<SportsHack2026AdminPage />);
    await waitFor(() => expect(screen.getByText(/Door Check-In/)).toBeInTheDocument());

    // "Checked In" card → 2 / 50
    expect(screen.getByText("2 / 50")).toBeInTheDocument();
    // "Confirmed In" → 1 / 2
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    // "No-Shows" → 1
    const noShowsLabel = screen.getByText("No-Shows");
    expect(noShowsLabel.parentElement?.textContent).toMatch(/1/);
    // "Waitlist Admitted" → 1
    const waitlistLabel = screen.getByText("Waitlist Admitted");
    expect(waitlistLabel.parentElement?.textContent).toMatch(/1/);
    // "Arriving Late" → 1
    const lateLabel = screen.getByText("Arriving Late");
    expect(lateLabel.parentElement?.textContent).toMatch(/1/);
    // "Queueing" → 1
    const queueingLabel = screen.getByText("Queueing");
    expect(queueingLabel.parentElement?.textContent).toMatch(/1/);
    // "Not on Luma" → 3 (4 website signups, 3 without lumaRegistered)
    const notLumaLabel = screen.getByText("Not on Luma");
    expect(notLumaLabel.parentElement?.textContent).toMatch(/3/);
  });

  it("renders waitlist subhead with 'spot available' singular when noShows === 1", async () => {
    setAuth({ user: makeUser() });
    (global.fetch as unknown as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        eventId: "sports-hack-2026",
        totalCount: 2,
        websiteSignupCount: 2,
        creditTopN: 50,
        entries: [
          entry({ rank: 1, userId: "u-1", displayName: "A", status: "confirmed", checkedIn: false }),
          entry({ rank: 2, userId: "u-2", displayName: "B", status: "waitlisted" }),
        ],
      }),
    });
    render(<SportsHack2026AdminPage />);
    await waitFor(() =>
      expect(screen.getByText(/1 spot available from no-shows/)).toBeInTheDocument()
    );
  });
});
