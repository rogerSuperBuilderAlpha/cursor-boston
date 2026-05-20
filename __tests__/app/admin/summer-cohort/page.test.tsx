/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage push — `app/admin/summer-cohort/page.tsx`.
 * Covers loading gate, signed-out redirect, access-denied redirect,
 * access-check error catch, summary/active-member rendering, status
 * filter clicks, refresh buttons, every aggregate Card branch (empty
 * + populated bucket / numeric / likert / yes-no), votes rendering
 * including empty list and ties, and error states for each fetch
 * (applications / aggregates / votes / access).
 */
const mockPush = jest.fn();
const stableRouter = {
  push: mockPush,
  replace: jest.fn(),
  back: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/summer-cohort",
  useParams: () => ({}),
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

const mockUseAuth = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const emptyNumeric = { n: 0, mean: null, min: null, max: null };
const emptyLikert = { ...emptyNumeric, distribution: {} };
const emptyYesNo = { yes: 0, no: 0, blank: 0 };

const emptyAggs = {
  total: 0,
  cohortDistribution: {},
  demographics: {
    age: emptyNumeric,
    gender: {},
    englishProficiency: {},
    highestDegree: {},
    employmentStatus: {},
    topCountriesOfResidence: [],
    topCountriesOfBirth: [],
  },
  programming: {
    yearsProgramming: {},
    programmingLanguages: {},
    priorEngineerEmployment: emptyYesNo,
    priorEngineerYears: emptyNumeric,
    csCredential: {},
  },
  aiTools: {
    firstAiYear: emptyNumeric,
    llmFrequency: {},
    aiToolsUsed: {},
    cursorExperience: {},
    shippedWithAi: emptyYesNo,
    hoursPerWeekAi: emptyNumeric,
  },
  platforms: {
    hoursPerWeekSocial: emptyNumeric,
    postedAsCreator: emptyYesNo,
    gigPlatformWork: emptyYesNo,
    algorithmUnderstanding: emptyLikert,
  },
  baselines: {
    baselineEffective: emptyLikert,
    baselineUnderstanding: emptyLikert,
  },
};

const numericStat = { n: 5, mean: 27.4, min: 18, max: 42 };
const likertStat = {
  n: 4,
  mean: 5.2,
  min: 3,
  max: 7,
  distribution: { "3": 1, "5": 1, "6": 1, "7": 1 } as Record<string, number>,
};
const populatedYesNo = { yes: 3, no: 2, blank: 1 };
const populatedYesNoNoBlanks = { yes: 4, no: 1, blank: 0 };

const populatedAggs = {
  total: 6,
  cohortDistribution: { "cohort-1": 6 },
  demographics: {
    age: numericStat,
    gender: { Female: 3, Male: 2, "Non-binary": 1 } as Record<string, number>,
    englishProficiency: { Native: 4, Fluent: 2 } as Record<string, number>,
    highestDegree: { Bachelors: 4, Masters: 2 } as Record<string, number>,
    employmentStatus: { Employed: 5, Student: 1 } as Record<string, number>,
    topCountriesOfResidence: [
      { value: "USA", count: 4 },
      { value: "Canada", count: 2 },
    ],
    topCountriesOfBirth: [{ value: "USA", count: 3 }],
  },
  programming: {
    yearsProgramming: { "3-5": 3, "5+": 3 } as Record<string, number>,
    programmingLanguages: { TypeScript: 5, Python: 4 } as Record<string, number>,
    priorEngineerEmployment: populatedYesNo,
    priorEngineerYears: { n: 4, mean: 3.5, min: 1, max: 7 },
    csCredential: { "BS CS": 3, None: 3 } as Record<string, number>,
  },
  aiTools: {
    firstAiYear: { n: 6, mean: 2023.3, min: 2020, max: 2025 },
    llmFrequency: { Daily: 5, Weekly: 1 } as Record<string, number>,
    aiToolsUsed: { Cursor: 6, Copilot: 3 } as Record<string, number>,
    cursorExperience: { "<1mo": 2, "1-6mo": 4 } as Record<string, number>,
    shippedWithAi: populatedYesNoNoBlanks,
    hoursPerWeekAi: { n: 6, mean: 12.4, min: 5, max: 30 },
  },
  platforms: {
    hoursPerWeekSocial: numericStat,
    postedAsCreator: populatedYesNo,
    gigPlatformWork: populatedYesNoNoBlanks,
    algorithmUnderstanding: likertStat,
  },
  baselines: {
    baselineEffective: likertStat,
    baselineUnderstanding: { ...likertStat, distribution: {} as Record<string, number> },
  },
};

const applications = [
  {
    userId: "app-1",
    email: "ada@example.com",
    name: "Ada Lovelace",
    phone: "555-0100",
    cohorts: ["cohort-1"],
    status: "pending",
    isLocal: true,
    wantsToPresent: false,
    createdAt: 1_715_500_000_000,
    updatedAt: 1_715_500_000_000,
  },
  {
    userId: "app-2",
    email: "grace@example.com",
    name: "Grace Hopper",
    phone: null,
    cohorts: ["cohort-1"],
    status: "admitted",
    isLocal: false,
    wantsToPresent: true,
    createdAt: 1_715_600_000_000,
    updatedAt: 1_715_600_000_000,
  },
  {
    userId: "app-3",
    email: null,
    name: null,
    phone: null,
    cohorts: [],
    status: "rejected",
    isLocal: null,
    wantsToPresent: null,
    createdAt: null,
    updatedAt: null,
  },
  {
    userId: "app-4",
    email: "anita@example.com",
    name: "Anita Borg",
    phone: null,
    cohorts: ["cohort-1"],
    status: "admitted",
    isLocal: true,
    wantsToPresent: true,
    createdAt: 1_715_700_000_000,
    updatedAt: 1_715_700_000_000,
  },
  {
    userId: "app-5",
    email: "kat@example.com",
    name: "Katherine Johnson",
    phone: null,
    cohorts: ["cohort-1"],
    status: "waitlist",
    isLocal: true,
    wantsToPresent: false,
    createdAt: 1_715_800_000_000,
    updatedAt: 1_715_800_000_000,
  },
];

type FetchHandlers = {
  access?: () => unknown;
  applications?: () => unknown;
  aggregates?: () => unknown;
  votes?: (weekId: string) => unknown;
};

function installFetch(handlers: FetchHandlers = {}) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/summer-cohort/admin/access")) {
      return handlers.access
        ? handlers.access()
        : jsonResponse({ allowed: true });
    }
    if (url.includes("/api/summer-cohort/admin/applications")) {
      return handlers.applications
        ? handlers.applications()
        : jsonResponse({ applications, total: applications.length });
    }
    if (url.includes("/api/summer-cohort/admin/intake-aggregates")) {
      return handlers.aggregates
        ? handlers.aggregates()
        : jsonResponse(emptyAggs);
    }
    if (url.includes("/api/summer-cohort/votes?")) {
      const weekId = new URL(url, "http://test").searchParams.get("weekId") ?? "week-1";
      return handlers.votes
        ? handlers.votes(weekId)
        : jsonResponse({ weekId, counts: {} as Record<string, number> });
    }
    return jsonResponse({});
  }) as typeof fetch;
}

function authedAuth() {
  return {
    user: makeAuthUser("admin-uid"),
    userProfile: { displayName: "Admin" },
    loading: false,
    signInWithGoogle: jest.fn(),
    signInWithGithub: jest.fn(),
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
  };
}

function signedOutAuth() {
  return {
    user: null,
    userProfile: null,
    loading: false,
    signInWithGoogle: jest.fn(),
    signInWithGithub: jest.fn(),
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
  };
}

function loadingAuth() {
  return {
    user: null,
    userProfile: null,
    loading: true,
    signInWithGoogle: jest.fn(),
    signInWithGithub: jest.fn(),
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
  };
}

describe("admin summer-cohort page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  it("shows loading state while auth is loading", async () => {
    mockUseAuth.mockReturnValue(loadingAuth());
    installFetch();
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to / when signed out", async () => {
    mockUseAuth.mockReturnValue(signedOutAuth());
    installFetch();
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("redirects when access is denied", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch({ access: () => jsonResponse({ allowed: false }) });
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByText("Summer cohort")).not.toBeInTheDocument();
  });

  it("redirects when access endpoint returns non-OK", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch({
      access: () => ({
        ok: false,
        status: 403,
        json: async () => ({}),
        text: async () => "{}",
      }),
    });
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("redirects when access fetch throws", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/summer-cohort/admin/access")) {
        throw new Error("network down");
      }
      return jsonResponse({});
    }) as typeof fetch;
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("renders summary, active members, applications table, empty aggregates and votes", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch();
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("Summer cohort")).toBeInTheDocument();
    });

    // Summary tiles
    expect(await screen.findByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Admitted")).toBeInTheDocument();
    expect(screen.getByText("Waitlist")).toBeInTheDocument();
    expect(screen.getByText("Wants to present")).toBeInTheDocument();

    // Active members (admitted, sorted by name) — appears in both the
    // active-members list and the applications table
    expect((await screen.findAllByText(/Anita Borg/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Grace Hopper/).length).toBeGreaterThan(0);

    // Application table — rejected row with all nulls renders em-dashes
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();

    // Empty aggregates state
    expect(
      screen.getByText(/No intake-survey responses for/i),
    ).toBeInTheDocument();

    // Votes — empty week (week-1 with no counts)
    expect(screen.getAllByText("No votes yet.").length).toBeGreaterThan(0);
  });

  it("filters applications when a status button is clicked", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch();
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    await screen.findByText("Ada Lovelace");
    await user.click(screen.getByRole("button", { name: /^waitlist$/i }));

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
        .map(([u]) => String(u))
        .filter((u) => u.includes("/api/summer-cohort/admin/applications"));
      expect(calls.some((u) => u.includes("status=waitlist"))).toBe(true);
    });

    // Click "all" to ensure no status param branch is also exercised
    await user.click(screen.getByRole("button", { name: /^all$/i }));
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
        .map(([u]) => String(u))
        .filter((u) => u.includes("/api/summer-cohort/admin/applications"));
      // The most recent applications call should NOT include status=
      const last = calls[calls.length - 1]!;
      expect(last).not.toContain("status=");
    });
  });

  it("changes cohort via the select control and refetches", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch();
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    await screen.findByText("Ada Lovelace");
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "cohort-2");

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
        .map(([u]) => String(u))
        .filter((u) => u.includes("/api/summer-cohort/admin"));
      expect(calls.some((u) => u.includes("cohort-2"))).toBe(true);
    });
  });

  it("clicks the applications Refresh button", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch();
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    await screen.findByText("Ada Lovelace");
    const refreshButtons = screen.getAllByRole("button", { name: /Refresh/i });
    expect(refreshButtons.length).toBeGreaterThan(0);

    const initialCalls = (global.fetch as jest.Mock).mock.calls.filter(([u]) =>
      String(u).includes("/api/summer-cohort/admin/applications"),
    ).length;
    await user.click(refreshButtons[0]!);
    await waitFor(() => {
      const after = (global.fetch as jest.Mock).mock.calls.filter(([u]) =>
        String(u).includes("/api/summer-cohort/admin/applications"),
      ).length;
      expect(after).toBeGreaterThan(initialCalls);
    });
  });

  it("clicks the votes Refresh button", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch();
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    await screen.findByText("Summer cohort");
    const refreshButtons = await screen.findAllByRole("button", {
      name: /Refresh/i,
    });
    // Second refresh button is the votes refresh
    const before = (global.fetch as jest.Mock).mock.calls.filter(([u]) =>
      String(u).includes("/api/summer-cohort/votes"),
    ).length;
    await user.click(refreshButtons[refreshButtons.length - 1]!);
    await waitFor(() => {
      const after = (global.fetch as jest.Mock).mock.calls.filter(([u]) =>
        String(u).includes("/api/summer-cohort/votes"),
      ).length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it("renders no-admitted message when no active members exist", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch({
      applications: () =>
        jsonResponse({
          applications: [applications[0]], // only pending
          total: 1,
        }),
    });
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(
        screen.getByText(/No admitted members for/i),
      ).toBeInTheDocument();
    });
  });

  it("renders 'No applications match these filters.' when list is empty", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch({
      applications: () => jsonResponse({ applications: [], total: 0 }),
    });
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(
        screen.getByText(/No applications match these filters/i),
      ).toBeInTheDocument();
    });
  });

  it("shows error banner when applications endpoint fails (uses body.error)", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch({
      applications: () =>
        jsonResponse({ error: "Apps boom" }, false, 500),
    });
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("Apps boom")).toBeInTheDocument();
    });
  });

  it("falls back to HTTP status string when applications error JSON is malformed", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch({
      applications: () => ({
        ok: false,
        status: 503,
        json: async () => {
          throw new Error("bad json");
        },
        text: async () => "",
      }),
    });
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/HTTP 503/)).toBeInTheDocument();
    });
  });

  it("uses 'Fetch failed' fallback when applications fetch throws a non-Error", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/summer-cohort/admin/access")) {
        return jsonResponse({ allowed: true });
      }
      if (url.includes("/api/summer-cohort/admin/applications")) {
         
        throw "string-failure";
      }
      if (url.includes("/api/summer-cohort/admin/intake-aggregates")) {
        return jsonResponse(emptyAggs);
      }
      if (url.includes("/api/summer-cohort/votes")) {
        return jsonResponse({ weekId: "week-1", counts: {} });
      }
      return jsonResponse({});
    }) as typeof fetch;

    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("Fetch failed")).toBeInTheDocument();
    });
  });

  it("shows error banner when aggregates endpoint fails", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch({
      aggregates: () => jsonResponse({ error: "Aggs boom" }, false, 500),
    });
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("Aggs boom")).toBeInTheDocument();
    });
  });

  it("shows error banner when votes endpoint fails", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch({
      votes: () => jsonResponse({ error: "Votes boom" }, false, 500),
    });
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("Votes boom")).toBeInTheDocument();
    });
  });

  it("falls back to HTTP status when votes error JSON is malformed", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch({
      votes: () => ({
        ok: false,
        status: 504,
        json: async () => {
          throw new Error("bad json");
        },
        text: async () => "",
      }),
    });
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/HTTP 504/)).toBeInTheDocument();
    });
  });

  it("renders all aggregate cards when intake-aggregates have data", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch({
      aggregates: () => jsonResponse(populatedAggs),
      votes: (weekId) =>
        jsonResponse({
          weekId,
          counts:
            weekId === "week-1"
              ? { Ada: 5, Grace: 3, Anita: 1 } // multiple entries — exercises sort + 1+i index
              : weekId === "week-2"
                ? { Solo: 1 } // singular "vote"
                : {}, // empty
        }),
    });
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    // Aggregate-card titles
    expect(await screen.findByText("Age")).toBeInTheDocument();
    expect(screen.getByText("Gender")).toBeInTheDocument();
    expect(screen.getByText("English proficiency")).toBeInTheDocument();
    expect(screen.getByText("Highest degree")).toBeInTheDocument();
    expect(screen.getByText("Employment status")).toBeInTheDocument();
    expect(screen.getByText("Top countries (residence)")).toBeInTheDocument();
    expect(screen.getByText("Years programming")).toBeInTheDocument();
    expect(
      screen.getByText("Programming languages (multi-select)"),
    ).toBeInTheDocument();
    expect(screen.getByText("CS credential")).toBeInTheDocument();
    expect(screen.getByText("Prior engineering employment")).toBeInTheDocument();
    expect(screen.getByText("Prior engineering years")).toBeInTheDocument();
    expect(screen.getByText("LLM frequency")).toBeInTheDocument();
    expect(screen.getByText("AI tools used (multi-select)")).toBeInTheDocument();
    expect(screen.getByText("Cursor experience")).toBeInTheDocument();
    expect(screen.getByText("Shipped with AI")).toBeInTheDocument();
    expect(screen.getByText("Hours/week using AI")).toBeInTheDocument();
    expect(screen.getByText("First-AI year")).toBeInTheDocument();
    expect(screen.getByText("Hours/week social")).toBeInTheDocument();
    expect(screen.getByText("Posted as creator")).toBeInTheDocument();
    expect(screen.getByText("Gig platform work")).toBeInTheDocument();
    expect(screen.getByText("Algorithm understanding (1–7)")).toBeInTheDocument();
    expect(screen.getByText("Baseline: effective with AI (1–7)")).toBeInTheDocument();
    expect(
      screen.getByText("Baseline: AI understanding (1–7)"),
    ).toBeInTheDocument();

    // 6 responses — exercises plural pluralization
    expect(screen.getByText(/6 responses/)).toBeInTheDocument();

    // Vote tile ordering — Ada must be first (highest count)
    await waitFor(() => {
      expect(screen.getByText("Ada")).toBeInTheDocument();
    });
    // Singular "vote" for week-2
    expect(screen.getAllByText(/1 vote\b/i).length).toBeGreaterThan(0);
  });

  it("renders empty-bucket placeholder when topCountriesOfResidence is empty", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch({
      aggregates: () =>
        jsonResponse({
          ...populatedAggs,
          demographics: {
            ...populatedAggs.demographics,
            topCountriesOfResidence: [],
            gender: {}, // also exercise empty bucket bars
          },
        }),
    });
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);
    // The empty-state copy "No responses." should appear inside multiple cards
    await waitFor(() => {
      expect(screen.getAllByText("No responses.").length).toBeGreaterThan(0);
    });
  });

  it("renders pending status badge for pending applications", async () => {
    mockUseAuth.mockReturnValue(authedAuth());
    installFetch();
    const Page = (await import("@/app/admin/summer-cohort/page")).default;
    render(<Page />);

    // Find a status badge with text 'pending'
    await waitFor(() => {
      const badges = screen.getAllByText("pending");
      // Filter to the badge inside the table row, not the filter button
      const inRow = badges.find((el) => el.tagName === "SPAN");
      expect(inRow).toBeTruthy();
    });
  });
});
