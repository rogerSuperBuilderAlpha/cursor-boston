/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import type { AnalyticsSummary } from "@/app/api/analytics/summary/route";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/analytics",
}));

jest.mock("@/lib/firebase", () => ({ db: null, auth: null }));
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

// Mock recharts — rendering real SVG charts in jsdom is unreliable
jest.mock("recharts", () => {
  const OriginalModule = jest.requireActual("recharts");
  return {
    ...OriginalModule,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactNode;
      width?: string | number;
      height?: number;
    }) => <div data-testid="responsive-container">{children}</div>,
  };
});

import AnalyticsDashboard from "@/components/AnalyticsDashboard";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MOCK_SUMMARY: AnalyticsSummary = {
  totalMembers: 150,
  totalEventRegistrations: 320,
  totalShowcaseProjects: 45,
  totalShowcaseInteractions: 890,
  memberGrowth: [
    { month: "2025-06", count: 10 },
    { month: "2025-07", count: 15 },
  ],
  eventAttendance: [
    { eventId: "e1", name: "AI Workshop", count: 40 },
    { eventId: "e2", name: "Demo Night", count: 60 },
  ],
  skillDistribution: [
    { skill: "React", count: 30 },
    { skill: "Python", count: 25 },
  ],
  hackathonStats: {
    teamsFormed: 12,
    projectsSubmitted: 8,
    teamsAsPercentOfMembers: 8,
  },
  communityActivity: [
    { week: "2025-W20", posts: 5, replies: 12 },
    { week: "2025-W21", posts: 8, replies: 15 },
  ],
  platformHealth: {
    activeThisMonth: 42,
    returningMembers: 28,
  },
  showcaseOverTime: [
    { month: "2025-06", count: 5 },
    { month: "2025-07", count: 10 },
  ],
  generatedAt: "2025-07-15T12:00:00.000Z",
};

function mockFetchSuccess(data: AnalyticsSummary) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFetchFailure() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({}),
  });
}

// Stub requestAnimationFrame for useCountUp hook
const originalRAF = window.requestAnimationFrame;
const originalCAF = window.cancelAnimationFrame;

beforeAll(() => {
  window.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
    cb(performance.now() + 2000); // jump past animation duration
    return 0;
  });
  window.cancelAnimationFrame = jest.fn();
});

afterAll(() => {
  window.requestAnimationFrame = originalRAF;
  window.cancelAnimationFrame = originalCAF;
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("AnalyticsDashboard", () => {
  it("shows loading skeleton initially", () => {
    // Never-resolving fetch to keep it in loading state
    global.fetch = jest.fn(
      () => new Promise<Response>(() => {})
    );

    render(<AnalyticsDashboard />);
    // Loading state renders multiple pulse skeletons
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("renders error message on fetch failure", async () => {
    mockFetchFailure();

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText("Analytics are unavailable right now. Please try again later.")
      ).toBeInTheDocument();
    });
  });

  it("renders stat cards with data after successful fetch", async () => {
    mockFetchSuccess(MOCK_SUMMARY);

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Total Members")).toBeInTheDocument();
    });

    expect(screen.getByText("Event Registrations")).toBeInTheDocument();
    expect(screen.getByText("Showcase Projects")).toBeInTheDocument();
    expect(screen.getByText("Showcase Interactions")).toBeInTheDocument();
  });

  it("renders platform health cards", async () => {
    mockFetchSuccess(MOCK_SUMMARY);

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText("Active Members This Month")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Returning Members")).toBeInTheDocument();
  });

  it("renders hackathon stats section", async () => {
    mockFetchSuccess(MOCK_SUMMARY);

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Hackathon Stats")).toBeInTheDocument();
    });

    expect(screen.getByText("Teams Formed")).toBeInTheDocument();
    expect(screen.getByText("Projects Submitted")).toBeInTheDocument();
    expect(screen.getByText("Teams as % of Members")).toBeInTheDocument();
  });

  it("renders chart titles", async () => {
    mockFetchSuccess(MOCK_SUMMARY);

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText("Member Growth (Last 12 Months)")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Top Events by Registrations")).toBeInTheDocument();
    expect(screen.getByText("Top Skills in Community")).toBeInTheDocument();
    expect(
      screen.getByText("Community Feed Activity (Last 8 Weeks)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Showcase Submissions Over Time")
    ).toBeInTheDocument();
  });

  it("renders generatedAt timestamp", async () => {
    mockFetchSuccess(MOCK_SUMMARY);

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Data cached hourly/)).toBeInTheDocument();
    });
  });

  it("shows empty chart messages when data arrays are empty", async () => {
    const emptyData: AnalyticsSummary = {
      ...MOCK_SUMMARY,
      memberGrowth: [],
      eventAttendance: [],
      skillDistribution: [],
      communityActivity: [],
      showcaseOverTime: [],
    };
    mockFetchSuccess(emptyData);

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText("No member growth data available yet.")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("No event registration data available yet.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No skill data yet. Skills are sourced from pair programming profiles."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("No community feed activity data available yet.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No showcase submissions yet.")
    ).toBeInTheDocument();
  });

  it("calls fetch with the correct API endpoint", async () => {
    mockFetchSuccess(MOCK_SUMMARY);

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/analytics/summary",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });
});
