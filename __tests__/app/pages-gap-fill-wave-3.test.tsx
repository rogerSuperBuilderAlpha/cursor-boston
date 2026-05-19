/**
 * @jest-environment jsdom
 *
 * Wave 3: hack-a-sprint hub, PyData event, PR ideas, open source, game pages.
 */
import "@/__tests__/app/_shared/page-test-setup";

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

jest.mock("@/app/pr-ideas/_hooks/useIdeaRuns", () => ({
  useIdeaRuns: () => ({
    runs: [],
    selectedRun: null,
    selectedRunId: null,
    setSelectedRunId: jest.fn(),
    hasRuns: false,
    hasActiveRun: false,
    loadingState: "idle",
    runAction: null,
    syncingRunId: null,
    error: null,
    runErrors: {},
    githubIssues: [],
    githubIssuesLoading: false,
    githubIssuesError: null,
    loadRuns: jest.fn(),
    loadGithubIssues: jest.fn(),
    launchIdeaRun: jest.fn(),
    refreshRun: jest.fn(),
    mutateRun: jest.fn(),
    advanceWorkflow: jest.fn(),
    clearError: jest.fn(),
  }),
}));

jest.mock("@/components/cookbook/PromptMarkdown", () => ({
  PromptMarkdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/lib/pydata-submissions", () => ({
  getPyDataSubmissions: jest.fn(() => []),
  PYDATA_SUBMISSIONS_BRANCH: "pydata-2026-submissions",
  PYDATA_SUBMISSIONS_DIR: "pydata-2026-submissions",
  PYDATA_SUBMISSIONS_REPO_URL:
    "https://github.com/rogerSuperBuilderAlpha/cursor-boston",
}));

jest.mock("@/components/events/CursorSubmitPromptButton", () => ({
  CursorSubmitPromptButton: () => <button type="button">Copy submit prompt</button>,
}));

const mockUseAuth = useAuth as jest.Mock;

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function installGameFetch() {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/game/player")) {
      return jsonResponse({
        success: true,
        player: {
          userId: "u1",
          displayName: "Test General",
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          turnsSpentTotal: 5,
          tilesExplored: 3,
          stats: { tilesHeld: 5, unitsAlive: 10 },
        },
      });
    }
    if (url.includes("/api/game/tiles")) {
      return jsonResponse({
        success: true,
        tiles: [
          {
            tileId: "0_0",
            q: 0,
            r: 0,
            type: "military",
            ownerId: "u1",
            units: { ground: 5, air: 0, siege: 0 },
          },
        ],
      });
    }
    if (url.includes("/api/game/attacks")) {
      return jsonResponse({
        success: true,
        attacks: [],
        nextCursor: null,
        hasMore: false,
      });
    }
    if (url.includes("/api/game/leaderboard")) {
      return jsonResponse({
        success: true,
        players: [
          {
            userId: "u1",
            displayName: "Test General",
            caste: "red",
            phase: "play",
            tilesHeld: 5,
            unitsAlive: 10,
            attacksWon: 0,
            attacksLost: 0,
          },
        ],
        nextCursor: null,
        hasMore: false,
      });
    }
    if (url.includes("/api/hackathons/showcase/hack-a-sprint-2026/submissions")) {
      return jsonResponse({
        phase: "submissionOpen",
        viewer: {
          checkedIn: false,
          signedUp: false,
          hasCompletedPeerVoting: false,
          judgeEligible: false,
          isJudge: false,
          peerScoresRevealed: false,
          myParticipantScores: {},
          canPeerVote: false,
          isSubmitter: false,
        },
        submissions: [],
      });
    }
    if (url.includes("/api/hackathons/showcase/hack-a-sprint-2026/me")) {
      return jsonResponse({
        phase: "submissionOpen",
        signedUp: false,
        checkedIn: false,
        hasCompletedPeerVoting: false,
        prizeEligible: false,
        highScoreCount: 0,
        requiredHighScores: 0,
        participantEligible: false,
        judgeEligible: false,
        githubLogin: null,
      });
    }
    if (url.includes("/api/hackathons/showcase/hack-a-sprint-2026/credit-code")) {
      return jsonResponse({ code: null });
    }
    return jsonResponse({});
  }) as typeof fetch;
}

type PageCase = {
  name: string;
  loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>;
  signedIn?: boolean;
};

const PAGES: PageCase[] = [
  {
    name: "hackathons/hack-a-sprint-2026",
    loader: () => import("@/app/hackathons/hack-a-sprint-2026/page"),
    signedIn: true,
  },
  {
    name: "events/cursor-boston-pydata-2026",
    loader: () => import("@/app/events/cursor-boston-pydata-2026/page"),
  },
  {
    name: "pr-ideas",
    loader: () => import("@/app/pr-ideas/page"),
    signedIn: true,
  },
  {
    name: "open-source",
    loader: () => import("@/app/open-source/page"),
  },
  {
    name: "game/zero-turn",
    loader: () => import("@/app/game/zero-turn/page"),
    signedIn: true,
  },
  {
    name: "game/attacks",
    loader: () => import("@/app/game/attacks/page"),
    signedIn: true,
  },
  {
    name: "game/leaderboard",
    loader: () => import("@/app/game/leaderboard/page"),
    signedIn: true,
  },
];

describe("pages gap-fill wave 3", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installGameFetch();
  });

  it.each(PAGES)("renders $name without throwing", async ({ loader, signedIn }) => {
    if (signedIn) {
      mockUseAuth.mockReturnValue({
        user: makeAuthUser("uid-wave3"),
        userProfile: {
          displayName: "Wave Three",
          cursor: { apiKeyFingerprint: "cur_abcd", monthlyCapUsd: 20 },
        },
        loading: false,
        signInWithGoogle: jest.fn(),
        signInWithGithub: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        refreshUserProfile: jest.fn(),
      });
    } else {
      mockUseAuth.mockReturnValue({
        user: null,
        userProfile: null,
        loading: false,
        signInWithGoogle: jest.fn(),
        signInWithGithub: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
      });
    }

    const { default: Page } = await loader();
    const { container } = render(<Page />);
    await waitFor(
      () => {
        expect(container.textContent?.length ?? 0).toBeGreaterThan(20);
      },
      { timeout: 5000 },
    );
  });
});
