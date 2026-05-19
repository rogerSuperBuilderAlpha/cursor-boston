/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";

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

jest.mock("@/app/(auth)/profile/_hooks/useGithubConnection", () => ({
  useGithubConnection: () => ({
    githubInfo: null,
    connecting: false,
    disconnecting: false,
    error: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

jest.mock("@/app/(auth)/profile/_hooks/useDiscordConnection", () => ({
  useDiscordConnection: () => ({
    discordInfo: null,
    connecting: false,
    disconnecting: false,
    error: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/hackathons/events") && url.includes("/signup")) {
      return {
        ok: true,
        json: async () => ({
          eventId: "hack-a-sprint-2026",
          totalCount: 0,
          entries: [],
          creditTopN: 10,
          me: null,
        }),
      };
    }
    if (url.includes("/api/profile/visibility")) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          profile: {
            hasGithub: false,
            hasDiscord: false,
            visibility: { isPublic: false, showDiscord: false },
          },
        }),
      };
    }
    if (url.includes("/submissions")) {
      return {
        ok: true,
        json: async () => ({
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
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({}),
      text: async () => "{}",
    };
  }) as typeof fetch;
  mockUseAuth.mockReturnValue({
    user: null,
    userProfile: null,
    loading: false,
  });
});

const PAGES: Array<{
  name: string;
  load: () => Promise<{ default: React.ComponentType }>;
}> = [
  { name: "mentorship", load: () => import("@/app/mentorship/page") },
  { name: "pair", load: () => import("@/app/pair/page") },
  { name: "hackathons/pool", load: () => import("@/app/hackathons/pool/page") },
  { name: "hackathons/team", load: () => import("@/app/hackathons/team/page") },
  { name: "hackathons/teams", load: () => import("@/app/hackathons/teams/page") },
  { name: "cfp", load: () => import("@/app/cfp/page") },
  {
    name: "admin/summer-cohort",
    load: () => import("@/app/admin/summer-cohort/page"),
  },
  {
    name: "hackathons/sports-hack-2026/signup",
    load: () => import("@/app/hackathons/sports-hack-2026/signup/page"),
  },
  {
    name: "hackathons/hack-a-sprint-2026/signup",
    load: () => import("@/app/hackathons/hack-a-sprint-2026/signup/page"),
  },
  {
    name: "hackathons/hack-a-sprint-2026/admin",
    load: () => import("@/app/hackathons/hack-a-sprint-2026/admin/page"),
  },
  {
    name: "hackathons/hack-a-sprint-2026",
    load: () => import("@/app/hackathons/hack-a-sprint-2026/page"),
  },
  { name: "showcase", load: () => import("@/app/showcase/page") },
  { name: "summer-cohort", load: () => import("@/app/summer-cohort/page") },
  { name: "game/threats", load: () => import("@/app/game/threats/page") },
];

describe("high-value app pages", () => {
  it.each(PAGES)("renders %s", async ({ load }) => {
    const { default: Page } = await load();
    const { container } = render(<Page />);
    await waitFor(
      () => {
        expect(container.innerHTML.length).toBeGreaterThan(10);
      },
      { timeout: 3000 },
    );
  });
});
