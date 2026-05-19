/**
 * @jest-environment jsdom
 *
 * Wave 2: targeted renders for high-uncovered app pages (auth + fetch mocks).
 */
import "@/__tests__/app/_shared/page-test-setup";

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

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

jest.mock("@/lib/mentorship/data", () => ({
  getMentorshipProfile: jest.fn().mockResolvedValue(null),
  getAllActiveMentorshipProfiles: jest.fn().mockResolvedValue([]),
  getMentorshipPairingsForUser: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/pair-programming/data", () => ({
  getPairProfile: jest.fn().mockResolvedValue(null),
  getAllActiveProfiles: jest.fn().mockResolvedValue([]),
  getPairSessionsForUser: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/pair-programming/matching", () => ({
  getTopMatches: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/cfp-submissions", () => ({
  ...jest.requireActual("@/lib/cfp-submissions"),
  getCfpSubmission: jest.fn().mockResolvedValue(null),
  submitCfpProposal: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;

const emptyNumeric = { n: 0, mean: null, min: null, max: null };
const emptyLikert = { ...emptyNumeric, distribution: {} };
const emptyYesNo = { yes: 0, no: 0, blank: 0 };

const emptyAdminAggregates = {
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

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function installFetch(handler: (url: string) => ReturnType<typeof jsonResponse> | null) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const custom = handler(url);
    if (custom) return custom;
    return jsonResponse({});
  }) as typeof fetch;
}

function installSignedOutFetch() {
  installFetch((url) => {
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
    if (url.includes("/api/mentorship/matches")) {
      return jsonResponse({ success: true, matches: [] });
    }
    return null;
  });
}

function installSignedInFetch() {
  installFetch((url) => {
    if (url.includes("/api/summer-cohort/apply")) {
      return jsonResponse({
        status: "not_applied",
        cohortId: "cohort-2",
        canApply: true,
      });
    }
    if (url.includes("/api/summer-cohort/admin/access")) {
      return jsonResponse({ allowed: true });
    }
    if (url.includes("/api/summer-cohort/admin/applications")) {
      return jsonResponse({ applications: [], total: 0 });
    }
    if (url.includes("/api/summer-cohort/admin/intake-aggregates")) {
      return jsonResponse(emptyAdminAggregates);
    }
    if (url.includes("/api/summer-cohort/votes?")) {
      return jsonResponse({ weekId: "week-1", counts: {} });
    }
    if (url.includes("/api/hackathons/team-dashboard")) {
      return jsonResponse({
        myTeam: null,
        memberProfiles: {},
        submission: null,
        myInvites: [],
        requestsToMyTeam: [],
      });
    }
    if (url.includes("/api/hackathons/pool-dashboard")) {
      return jsonResponse({
        poolEntries: [],
        inPool: false,
        poolUsers: {},
        myTeam: null,
        teamsWithSlots: [],
        teamMemberProfiles: {},
        successfulSubmissionsByTeam: {},
        myInvites: [],
        myInvitedUserIds: [],
        requestsToMyTeam: [],
        myPendingRequestTeamIds: [],
      });
    }
    if (url.includes("/api/hackathons/eligibility")) {
      return jsonResponse({ eligible: true });
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
    if (url.includes("/api/hackathons/events/sports-hack-2026/signup")) {
      return jsonResponse({
        eventId: "sports-hack-2026",
        totalCount: 0,
        websiteSignupCount: 0,
        entries: [],
        creditTopN: 10,
      });
    }
    if (url.includes("/api/pair/request")) {
      return jsonResponse({ success: true, requests: [] });
    }
    if (url.includes("/api/game/players/")) {
      return jsonResponse({
        success: true,
        player: {
          userId: "player-1",
          displayName: "Test General",
          caste: "blue",
          phase: "play",
          tilesExplored: 3,
          heroCount: 0,
          armageddonSealsBroken: 0,
          seasonNumber: 1,
          bio: "",
          bioUpdatedAt: null,
        },
        titles: [],
      });
    }
    if (url.includes("/api/game/pacts")) {
      return jsonResponse({ success: true, pacts: [] });
    }
    if (url.includes("/api/mentorship/matches")) {
      return jsonResponse({ success: true, matches: [] });
    }
    return null;
  });
}

type PageCase = {
  name: string;
  loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>;
  signedIn?: boolean;
  extraProps?: Record<string, unknown>;
};

const PAGES: PageCase[] = [
  { name: "mentorship", loader: () => import("@/app/mentorship/page"), signedIn: true },
  { name: "pair", loader: () => import("@/app/pair/page"), signedIn: true },
  {
    name: "hackathons/hack-a-sprint-2026",
    loader: () => import("@/app/hackathons/hack-a-sprint-2026/page"),
    signedIn: true,
  },
  { name: "hackathons/team", loader: () => import("@/app/hackathons/team/page"), signedIn: true },
  { name: "hackathons/pool", loader: () => import("@/app/hackathons/pool/page"), signedIn: true },
  {
    name: "summer-cohort",
    loader: () => import("@/app/summer-cohort/page"),
    signedIn: true,
  },
  {
    name: "admin/summer-cohort",
    loader: () => import("@/app/admin/summer-cohort/page"),
    signedIn: true,
  },
  { name: "cfp", loader: () => import("@/app/cfp/page"), signedIn: true },
  {
    name: "game/players/[playerId]",
    loader: () => import("@/app/game/players/[playerId]/page"),
    signedIn: true,
    extraProps: {
      params: (() => {
        const p = Promise.resolve({ playerId: "player-1" });
        (
          p as Promise<{ playerId: string }> & {
            __testResolvedValue: { playerId: string };
          }
        ).__testResolvedValue = { playerId: "player-1" };
        return p;
      })(),
    },
  },
  {
    name: "hackathons/sports-hack-2026/admin",
    loader: () => import("@/app/hackathons/sports-hack-2026/admin/page"),
    signedIn: true,
  },
];

describe("pages gap-fill wave 2", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(PAGES)("renders $name without throwing", async ({ loader, signedIn, extraProps }) => {
    if (signedIn) {
      mockUseAuth.mockReturnValue({
        user: makeAuthUser("uid-wave2"),
        userProfile: { displayName: "Wave Two", roles: ["maintainer"] },
        loading: false,
        signInWithGoogle: jest.fn(),
        signInWithGithub: jest.fn(),
        signOut: jest.fn(),
        refreshProfile: jest.fn(),
        refreshUserProfile: jest.fn(),
      });
      installSignedInFetch();
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
      installSignedOutFetch();
    }

    const { default: Page } = await loader();
    const { container } = render(
      extraProps ? <Page {...extraProps} /> : <Page />,
    );
    await waitFor(
      () => {
        expect(container.textContent?.length ?? 0).toBeGreaterThan(20);
      },
      { timeout: 5000 },
    );
  });
});
