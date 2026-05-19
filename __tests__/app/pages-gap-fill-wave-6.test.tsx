/**
 * @jest-environment jsdom
 *
 * Wave 6: deeper interactive RTL for pages still under ~70% branch coverage.
 */
import "@/__tests__/app/_shared/page-test-setup";

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import { getMentorshipProfile } from "@/lib/mentorship/data";
import { getPairProfile, getAllActiveProfiles } from "@/lib/pair-programming/data";
import { getTopMatches } from "@/lib/pair-programming/matching";
import {
  getCfpSubmission,
  submitCfpProposal,
} from "@/lib/cfp-submissions";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";
import { SPORTS_HACK_2026_EVENT_ID } from "@/lib/sports-hack-2026";

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
  getMentorshipProfile: jest.fn(),
  getAllActiveMentorshipProfiles: jest.fn().mockResolvedValue([]),
  getMentorshipPairingsForUser: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/pair-programming/data", () => ({
  getPairProfile: jest.fn(),
  getAllActiveProfiles: jest.fn(),
  getPairSessionsForUser: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/pair-programming/matching", () => ({
  getTopMatches: jest.fn(),
}));

jest.mock("@/lib/cfp-submissions", () => ({
  ...jest.requireActual("@/lib/cfp-submissions"),
  getCfpSubmission: jest.fn(),
  submitCfpProposal: jest.fn(),
}));

jest.mock("@/lib/badges/data", () => ({
  ...jest.requireActual("@/lib/badges/data"),
  ensureUserBadgesForEligibleWithStatus: jest.fn().mockResolvedValue({
    userBadgeMap: { "first-pr": { badgeId: "first-pr", earnedAt: "2026-01-01" } },
    status: { state: "complete" },
  }),
}));

jest.mock("@/components/NeedsWorkBanner", () => ({
  NeedsWorkBanner: () => null,
}));

jest.mock("@/components/ProfileRequirementsModal", () => ({
  __esModule: true,
  default: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen
      ? require("react").createElement(
          "motionless-modal",
          { "data-testid": "requirements-modal" },
          require("react").createElement(
            "button",
            { type: "button", onClick: onClose },
            "Close requirements",
          ),
        )
      : null,
}));

jest.mock("@/app/(auth)/profile/_hooks/useGithubConnection", () => ({
  useGithubConnection: () => ({
    githubInfo: { login: "wave6-user" },
    loading: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));
jest.mock("@/app/(auth)/profile/_hooks/useDiscordConnection", () => ({
  useDiscordConnection: () => ({
    discordInfo: { username: "wave6#0001" },
    loading: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMentorshipProfile = getMentorshipProfile as jest.Mock;
const mockGetPairProfile = getPairProfile as jest.Mock;
const mockGetAllActiveProfiles = getAllActiveProfiles as jest.Mock;
const mockGetTopMatches = getTopMatches as jest.Mock;
const mockGetCfpSubmission = getCfpSubmission as jest.Mock;
const mockSubmitCfpProposal = submitCfpProposal as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;
const mockAddDoc = addDoc as jest.Mock;
const mockUpdateDoc = updateDoc as jest.Mock;

const W6_UID = "uid-wave6";
const PARTNER_UID = "partner-wave6";
const MATCH_UID = "match-wave6";
const CLAIM_TOKEN = "claim-token-wave6";

const hackASprintSignupUrl = `/api/hackathons/events/${HACK_A_SPRINT_2026_EVENT_ID}/signup`;
const sportsSignupUrl = `/api/hackathons/events/${SPORTS_HACK_2026_EVENT_ID}/signup`;

const activeMentorshipProfile = {
  userId: W6_UID,
  role: "mentee" as const,
  expertise: [],
  learningGoals: ["System design"],
  preferredLanguages: ["TypeScript"],
  timezone: "America/New_York",
  availability: [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }],
  bio: "Learning backend patterns.",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const activePairProfile = {
  userId: W6_UID,
  skillsCanTeach: ["React"],
  skillsWantToLearn: ["Rust"],
  preferredLanguages: ["TypeScript"],
  preferredFrameworks: ["Next.js"],
  timezone: "America/New_York",
  availability: [{ dayOfWeek: 2, startTime: "14:00", endTime: "18:00" }],
  sessionTypes: ["build-together" as const],
  bio: "Pair on full-stack features.",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const hackASprintSubmission = {
  submissionId: "sub-wave6",
  githubLogin: "other-builder",
  payload: {
    projectRepoUrl: "https://github.com/example/sprint-demo",
    title: "Sprint Demo",
    description: "End-to-end hackathon submission.",
    loomVideoUrl: "https://www.loom.com/share/demo",
  },
  peerAverage: 4.2,
  peerVoteCount: 5,
  aiScore: 8.5,
  aiRank: 1,
  aiReasoning: "Polished demo with clear narrative.",
  judgeAverage: null,
  rawScore: null,
  myJudgeScore: null,
  myParticipantScore: null,
};

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
    text: async () => JSON.stringify(body),
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

function signedInAuth(extraProfile: Record<string, unknown> = {}) {
  return {
    user: { ...makeAuthUser(W6_UID), email: "student@mit.edu" },
    userProfile: { displayName: "Wave Six", ...extraProfile },
    loading: false,
    signInWithGoogle: jest.fn(),
    signInWithGithub: jest.fn(),
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
    refreshUserProfile: jest.fn(),
  };
}

function baseApplication(overrides: Record<string, unknown> = {}) {
  return {
    userId: W6_UID,
    email: "wave6@test.com",
    name: "Wave Six",
    phone: "555-0199",
    cohorts: ["cohort-1"],
    siteId: null,
    status: "pending",
    isLocal: true,
    wantsToPresent: true,
    mayImmersionRsvped: false,
    cohort1DevEnvConfirmedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function setupSummerCohortFetch(
  application: Record<string, unknown> | null,
  options: { intakeCompleted?: boolean } = {},
) {
  const { intakeCompleted = true } = options;
  global.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();

      if (url.includes("/api/summer-cohort/apply") && method === "GET") {
        return jsonResponse({
          application,
          applicationCounts: { "cohort-1": 42, "cohort-2": 18 },
        });
      }
      if (url.includes("/api/summer-cohort/apply") && method === "POST") {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const next = application
          ? { ...application, ...body }
          : { ...baseApplication(), status: "pending", ...body };
        return jsonResponse({
          application: next,
          applicationCounts: { "cohort-1": 43, "cohort-2": 18 },
        });
      }
      if (url.includes("/api/summer-cohort/intake-survey")) {
        if (method === "GET") {
          return jsonResponse({ completed: intakeCompleted, cohortId: "cohort-1" });
        }
        return jsonResponse({ success: true });
      }
      if (url.includes("/api/summer-cohort/submissions/")) {
        return jsonResponse({ submissions: [], merged: null, tryingToWin: null });
      }
      if (url.includes("/api/summer-cohort/my-score")) {
        return jsonResponse({ score: null });
      }
      return jsonResponse({});
    },
  ) as typeof fetch;
}

function installFirestoreDocs() {
  const mockDoc = doc as unknown as jest.Mock;
  if (typeof mockDoc.mockImplementation === "function") {
    mockDoc.mockImplementation((_db: unknown, ...segments: string[]) => ({
      path: segments.join("/"),
    }));
  }
  mockGetDoc.mockImplementation(async (ref: { path?: string }) => {
    const path = typeof ref?.path === "string" ? ref.path : "";
    if (path === `users/${PARTNER_UID}`) {
      return {
        exists: () => true,
        data: () => ({ displayName: "Partner Dev", photoURL: null }),
      };
    }
    if (path === `users/${MATCH_UID}`) {
      return {
        exists: () => true,
        data: () => ({ displayName: "Mentor Alex", photoURL: null }),
      };
    }
    return { exists: () => false, data: () => undefined };
  });
}

function installSignedInFetch(overrides: Record<string, unknown> = {}) {
  const {
    hackASprintPhase = "peerVotingOpen",
    canPeerVote = true,
    teamDashboard = null as Record<string, unknown> | null,
    poolDashboard = null as Record<string, unknown> | null,
    profileVisibility = {
      hasGithub: true,
      githubUsername: "wave6-user",
      hasDiscord: true,
      discordUsername: "wave6#0001",
      visibility: { isPublic: true, showDiscord: true },
    },
    sportsMe = null as Record<string, unknown> | null,
    hackASprintSignupMe = null as Record<string, unknown> | null,
  } = overrides;

  const defaultTeamDashboard = {
    myTeam: {
      id: "team-wave6",
      hackathonId: "virtual-2026-05",
      memberIds: [W6_UID, "member-2", "member-3"],
      name: "Wave Runners",
      createdBy: W6_UID,
      createdAt: "2026-05-01T12:00:00.000Z",
    },
    memberProfiles: {
      [W6_UID]: { uid: W6_UID, displayName: "Wave Six", photoURL: null },
      "member-2": { uid: "member-2", displayName: "Teammate Two", photoURL: null },
      "member-3": { uid: "member-3", displayName: "Teammate Three", photoURL: null },
    },
    submission: null,
    myInvites: [
      {
        id: "invite-wave6",
        fromUserId: "captain-1",
        toUserId: W6_UID,
        teamId: "team-other",
        status: "pending",
        createdAt: "2026-05-09T12:00:00.000Z",
      },
    ],
    requestsToMyTeam: [
      {
        id: "req-join-1",
        fromUserId: PARTNER_UID,
        teamId: "team-wave6",
        status: "pending",
        createdAt: "2026-05-11T12:00:00.000Z",
      },
    ],
  };

  const defaultPoolDashboard = {
    poolEntries: [
      {
        userId: PARTNER_UID,
        hackathonId: "2026-05",
        joinedAt: "2026-05-01T12:00:00.000Z",
      },
    ],
    inPool: false,
    poolUsers: {
      [PARTNER_UID]: {
        uid: PARTNER_UID,
        displayName: "Pool Partner",
        photoURL: null,
        github: { login: "poolpartner" },
      },
    },
    myTeam: null,
    teamsWithSlots: [
      {
        id: "team-open",
        hackathonId: "2026-05",
        memberIds: ["captain-1"],
        name: "Open Slots",
        createdBy: "captain-1",
        createdAt: "2026-05-01T12:00:00.000Z",
      },
    ],
    teamMemberProfiles: {
      "captain-1": { uid: "captain-1", displayName: "Captain One", photoURL: null },
    },
    successfulSubmissionsByTeam: {},
    myInvites: [],
    myInvitedUserIds: [],
    requestsToMyTeam: [],
    myPendingRequestTeamIds: [],
  };

  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.includes("/api/mentorship/matches")) {
      return jsonResponse({
        success: true,
        matches: [
          {
            userId: MATCH_UID,
            score: 85,
            reasons: ["Shared TypeScript focus"],
          },
        ],
      });
    }
    if (url.includes("/api/mentorship/request") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.includes("/api/mentorship/profile") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.includes("/api/pair/profile") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.includes("/api/pair/request") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.includes("/api/hackathons/showcase/hack-a-sprint-2026/submissions")) {
      return jsonResponse({
        phase: hackASprintPhase,
        viewer: {
          checkedIn: true,
          signedUp: true,
          hasCompletedPeerVoting: false,
          judgeEligible: false,
          isJudge: false,
          peerScoresRevealed: false,
          myParticipantScores: {},
          canPeerVote,
          isSubmitter: false,
        },
        submissions: [hackASprintSubmission],
      });
    }
    if (url === hackASprintSignupUrl) {
      if (method === "POST") return jsonResponse({ ok: true });
      return jsonResponse({
        eventId: HACK_A_SPRINT_2026_EVENT_ID,
        totalCount: 1,
        websiteSignupCount: 1,
        entries: [],
        creditTopN: 80,
        me: hackASprintSignupMe,
      });
    }
    if (url === sportsSignupUrl) {
      if (method === "POST") return jsonResponse({ ok: true });
      return jsonResponse({
        eventId: SPORTS_HACK_2026_EVENT_ID,
        totalCount: 0,
        websiteSignupCount: 0,
        entries: [],
        creditTopN: 80,
        me: sportsMe ?? {
          signedUp: false,
          rank: null,
          mergedPrCount: 0,
          signedUpAt: null,
          creditEligible: false,
          willBeLate: false,
          queuingForSpot: false,
          lumaRegistered: false,
        },
      });
    }
    if (url === "/api/profile/visibility") {
      return jsonResponse({ success: true, profile: profileVisibility });
    }
    if (url.includes("/api/hackathons/team-dashboard")) {
      return jsonResponse(teamDashboard ?? defaultTeamDashboard);
    }
    if (url.includes("/api/hackathons/pool-dashboard")) {
      return jsonResponse(poolDashboard ?? defaultPoolDashboard);
    }
    if (url.includes("/api/hackathons/eligibility")) {
      return jsonResponse({ eligible: true });
    }
    if (url.includes("/api/hackathons/pool/join") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.includes("/api/hackathons/invites/accept") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.includes("/api/hackathons/requests/accept") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.includes("/api/hackathons/submissions/register") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.includes("/api/hackathons/team/leave") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (
      url.includes("/api/hackathons/showcase/hack-a-sprint-2026/participant-score") &&
      method === "POST"
    ) {
      return jsonResponse({ success: true });
    }
    if (url.includes("/api/badges/definitions")) {
      return jsonResponse({
        definitions: [
          {
            id: "first-pr",
            name: "First PR",
            description: "Merged a pull request",
            category: "contribution",
            icon: "git-merge",
          },
        ],
        source: "firestore",
      });
    }
    if (url.includes("/api/profile/data")) {
      return jsonResponse({
        stats: { pullRequestsCount: 1, eventsAttended: 0, talksGiven: 0 },
        registrations: [],
        talks: [],
        badgeEligibility: {
          input: {
            hasDisplayName: true,
            isPublicProfile: true,
            pullRequestsCount: 1,
          },
          status: {
            state: "complete",
            isAuthoritative: true,
            failedSources: [],
          },
        },
        userBadgeMap: {},
      });
    }
    if (url.includes(`/api/agents/claim/${CLAIM_TOKEN}`)) {
      if (method === "POST") {
        return jsonResponse({
          success: true,
          message: "Agent linked to your account.",
        });
      }
      return jsonResponse({
        success: true,
        agent: {
          id: "agent-wave6",
          name: "Wave Bot",
          description: "Helps with community ops",
          status: "pending_claim",
          createdAt: { _seconds: 1_715_000_000 },
          claimExpiresAt: { _seconds: 1_800_000_000 },
        },
        profileStatus: {
          hasDisplayName: true,
          isPublic: true,
          displayName: "Wave Six",
        },
        canClaim: true,
      });
    }
    return jsonResponse({});
  }) as typeof fetch;
}

describe("pages gap-fill wave 6", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    localStorage.clear();
    mockGetMentorshipProfile.mockResolvedValue(null);
    mockGetPairProfile.mockResolvedValue(null);
    mockGetAllActiveProfiles.mockResolvedValue([]);
    mockGetTopMatches.mockResolvedValue([]);
    mockGetCfpSubmission.mockResolvedValue(null);
    mockSubmitCfpProposal.mockResolvedValue(undefined);
    mockAddDoc.mockResolvedValue({ id: "new-doc" });
    mockUpdateDoc.mockResolvedValue(undefined);
    installFirestoreDocs();
  });

  describe("summer-cohort page (applicant + admitted + rejected)", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(signedInAuth());
    });

    it("shows sign-in CTA when signed out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ submissions: [], merged: null, tryingToWin: null }),
      }) as typeof fetch;
      const Page = (await import("@/app/summer-cohort/page")).default;
      render(<Page />);
      expect(
        await screen.findByRole("heading", { name: /Create an account to apply/i }),
      ).toBeInTheDocument();
    });

    it("submits a new applicant via POST /api/summer-cohort/apply", async () => {
      setupSummerCohortFetch(null);
      const user = userEvent.setup();
      const Page = (await import("@/app/summer-cohort/page")).default;
      render(<Page />);

      await screen.findByRole("heading", { name: /^Apply$/i });
      await user.type(
        screen.getByLabelText(/^Name$/i, { selector: "input" }),
        "New Applicant",
      );
      await user.type(
        screen.getByLabelText(/^Phone$/i, { selector: "input" }),
        "555-1000",
      );
      await user.click(
        screen.getByRole("radio", {
          name: /Yes — I'm local and plan to attend live events/i,
        }),
      );
      await user.click(
        screen.getByRole("radio", {
          name: /Yes — count me in to present and maintain/i,
        }),
      );
      await user.click(screen.getByRole("button", { name: /Submit application/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/summer-cohort/apply",
          expect.objectContaining({ method: "POST" }),
        );
      });
      expect(await screen.findByText(/Status: Pending/i)).toBeInTheDocument();
    });

    it("renders pending status and saves edited application details", async () => {
      setupSummerCohortFetch(baseApplication({ status: "pending" }));
      const user = userEvent.setup();
      const Page = (await import("@/app/summer-cohort/page")).default;
      render(<Page />);

      expect(await screen.findByText(/Status: Pending/i)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /^Edit$/i }));
      const nameInput = await screen.findByLabelText(/^Name$/i);
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Applicant");
      await user.click(screen.getByRole("button", { name: /save updates/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/summer-cohort/apply",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("Updated Applicant"),
          }),
        );
      });
    });

    it("renders waitlist status panel", async () => {
      setupSummerCohortFetch(baseApplication({ status: "waitlist" }));
      const Page = (await import("@/app/summer-cohort/page")).default;
      render(<Page />);
      expect(await screen.findByText(/Status: Waitlist/i)).toBeInTheDocument();
      expect(screen.getByText(/You're on the waitlist/i)).toBeInTheDocument();
    });

    it("renders admitted dashboard and navigates week tabs", async () => {
      setupSummerCohortFetch(
        baseApplication({
          status: "admitted",
          mayImmersionRsvped: true,
          cohort1DevEnvConfirmedAt: Date.now(),
        }),
        { intakeCompleted: true },
      );
      const user = userEvent.setup();
      const Page = (await import("@/app/summer-cohort/page")).default;
      render(<Page />);

      expect(await screen.findByText(/Status: Admitted/i)).toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: /week 2: comms/i }));
      expect(await screen.findByText(/Week 2: Comms/i)).toBeInTheDocument();
    });

    it("renders rejected application status panel", async () => {
      setupSummerCohortFetch(baseApplication({ status: "rejected" }));
      const Page = (await import("@/app/summer-cohort/page")).default;
      render(<Page />);
      expect(await screen.findByText(/Status: Not selected/i)).toBeInTheDocument();
      expect(
        screen.getByText(/apply to a future cohort/i),
      ).toBeInTheDocument();
    });

    it("shows immersion RSVP todo when mayImmersionRsvped is false", async () => {
      setupSummerCohortFetch(
        baseApplication({ status: "pending", mayImmersionRsvped: false }),
      );
      const Page = (await import("@/app/summer-cohort/page")).default;
      render(<Page />);
      expect(await screen.findByText(/RSVP for Mon, May 26 on Luma/i)).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Reserve your spot/i }),
      ).toHaveAttribute("href", expect.stringContaining("luma.com"));
    });

    it("opens intake survey tab when admitted and survey incomplete", async () => {
      setupSummerCohortFetch(
        baseApplication({
          status: "admitted",
          mayImmersionRsvped: true,
          cohort1DevEnvConfirmedAt: Date.now(),
        }),
        { intakeCompleted: false },
      );
      const Page = (await import("@/app/summer-cohort/page")).default;
      render(<Page />);
      expect(await screen.findByText(/Why did you join the program/i)).toBeInTheDocument();
    });
  });

  describe("mentorship page", () => {
    it("saves a new mentorship profile from the setup form", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch();
      const Page = (await import("@/app/mentorship/page")).default;
      render(<Page />);

      expect(
        await screen.findByText("Set Up Your Mentorship Profile"),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("radio", { name: /Find a mentor/i }));
      const goalInput = screen.getByPlaceholderText(/Machine Learning/i);
      await user.type(goalInput, "System design");
      await user.keyboard("{Enter}");

      const langInput = screen.getByPlaceholderText(/TypeScript, Next.js/i);
      await user.type(langInput, "TypeScript");
      await user.keyboard("{Enter}");

      await user.click(screen.getByRole("button", { name: /Save Profile/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/mentorship/profile",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("System design"),
          }),
        );
      });
    });

    it("opens edit form from an existing active profile", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      mockGetMentorshipProfile.mockResolvedValue(activeMentorshipProfile);
      installSignedInFetch();
      const Page = (await import("@/app/mentorship/page")).default;
      render(<Page />);

      await screen.findByText("Mentor Alex");
      await user.click(screen.getByRole("button", { name: /Edit Profile/i }));
      expect(screen.getByText("Edit Your Mentorship Profile")).toBeInTheDocument();
    });
  });

  describe("pair page", () => {
    it("saves pair profile from setup form", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch();
      const Page = (await import("@/app/pair/page")).default;
      render(<Page />);

      expect(
        await screen.findByText(/Create Your Pair Programming Profile/i),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("checkbox", { name: /build together/i }));
      await user.click(screen.getByRole("button", { name: /Save Profile/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/pair/profile",
          expect.objectContaining({ method: "POST" }),
        );
      });
    });

    it("shows matches when profile is active", async () => {
      mockUseAuth.mockReturnValue(signedInAuth());
      mockGetPairProfile.mockResolvedValue(activePairProfile);
      mockGetAllActiveProfiles.mockResolvedValue([
        { ...activePairProfile, userId: PARTNER_UID },
      ]);
      mockGetTopMatches.mockResolvedValue([
        { userId: PARTNER_UID, score: 80, reasons: ["React overlap"] },
      ]);
      installSignedInFetch();
      const Page = (await import("@/app/pair/page")).default;
      render(<Page />);
      expect(await screen.findByText("Partner Dev")).toBeInTheDocument();
      expect(screen.getByText(/80% match/)).toBeInTheDocument();
    });
  });

  describe("hackathons team page", () => {
    it("declines a pending invite via Firestore update", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch();
      const Page = (await import("@/app/hackathons/team/page")).default;
      render(<Page />);

      await screen.findByText(/Invites to you/i);
      const declineButtons = await screen.findAllByRole("button", {
        name: /^Decline$/i,
      });
      await user.click(declineButtons[0]!);

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });
    });

    it("registers a repo URL for the team", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch();
      const Page = (await import("@/app/hackathons/team/page")).default;
      render(<Page />);

      const repoInput = await screen.findByPlaceholderText(
        "https://github.com/owner/repo",
      );
      await user.type(repoInput, "https://github.com/example/team-repo");
      await user.click(screen.getByRole("button", { name: /Register repo/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/hackathons/submissions/register",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("team-repo"),
          }),
        );
      });
    });

    it("accepts a join request to the user's team", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch();
      const Page = (await import("@/app/hackathons/team/page")).default;
      render(<Page />);

      expect(
        await screen.findByRole("heading", { name: /Requests to join your team/i }),
      ).toBeInTheDocument();
      const acceptButtons = screen.getAllByRole("button", { name: /^Accept$/i });
      await user.click(acceptButtons[acceptButtons.length - 1]!);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/hackathons/requests/accept",
          expect.objectContaining({ method: "POST" }),
        );
      });
    });
  });

  describe("hackathons pool page", () => {
    it("requests to join an open team via Firestore", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch({
        poolDashboard: {
          poolEntries: [],
          inPool: true,
          poolUsers: {},
          myTeam: null,
          teamsWithSlots: [
            {
              id: "team-open",
              hackathonId: "2026-05",
              memberIds: ["captain-1"],
              name: "Open Slots",
              createdBy: "captain-1",
              createdAt: "2026-05-01T12:00:00.000Z",
            },
          ],
          teamMemberProfiles: {
            "captain-1": {
              uid: "captain-1",
              displayName: "Captain One",
              photoURL: null,
            },
          },
          successfulSubmissionsByTeam: {},
          myInvites: [],
          myInvitedUserIds: [],
          requestsToMyTeam: [],
          myPendingRequestTeamIds: [],
        },
      });
      const Page = (await import("@/app/hackathons/pool/page")).default;
      render(<Page />);

      const requestBtn = await screen.findByRole("button", { name: /^Request$/i });
      await user.click(requestBtn);

      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalled();
      });
    });
  });

  describe("hack-a-sprint-2026 pages", () => {
    it("shows results phase copy when voting is closed", async () => {
      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch({ hackASprintPhase: "resultsOpen", canPeerVote: false });
      const Page = (await import("@/app/hackathons/hack-a-sprint-2026/page")).default;
      render(<Page />);
      expect(await screen.findByText("Sprint Demo")).toBeInTheDocument();
      expect(screen.getAllByText(/AI rank/i).length).toBeGreaterThan(0);
    });

    it("claims signup spot when profile requirements are met", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(
        signedInAuth({
          github: { login: "wave6-user" },
          visibility: { isPublic: true, showDiscord: true },
        }),
      );
      installSignedInFetch({
        hackASprintSignupMe: {
          signedUp: false,
          rank: null,
          mergedPrCount: 0,
          signedUpAt: null,
          creditEligible: false,
          willBeLate: false,
          queuingForSpot: false,
        },
      });
      const Page = (await import("@/app/hackathons/hack-a-sprint-2026/signup/page"))
        .default;
      render(<Page />);

      const claim = await screen.findByRole("button", { name: /Claim my spot/i });
      await user.click(claim);
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          hackASprintSignupUrl,
          expect.objectContaining({ method: "POST" }),
        );
      });
    });
  });

  describe("sports-hack-2026 signup page", () => {
    it("claims a spot when eligible and not yet signed up", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(
        signedInAuth({
          github: { login: "wave6-user" },
          discord: { username: "wave6#0001" },
          visibility: { isPublic: true, showDiscord: true },
        }),
      );
      installSignedInFetch({
        sportsMe: {
          signedUp: false,
          rank: null,
          mergedPrCount: 0,
          signedUpAt: null,
          creditEligible: true,
          willBeLate: false,
          queuingForSpot: false,
          lumaRegistered: true,
        },
      });
      const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
        .default;
      render(<Page />);

      const claim = await screen.findByRole("button", { name: /Claim my spot/i });
      await user.click(claim);
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          sportsSignupUrl,
          expect.objectContaining({ method: "POST" }),
        );
      });
    });
  });

  describe("cfp page", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-04-15T12:00:00.000Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("renders submission form for verified .edu users", async () => {
      mockUseAuth.mockReturnValue(signedInAuth());
      mockGetCfpSubmission.mockResolvedValue(null);
      const Page = (await import("@/app/cfp/page")).default;
      render(<Page />);

      expect(await screen.findByLabelText(/^Full Name/i)).toBeInTheDocument();
      expect(screen.getByText(/Using your verified .edu address/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Submit Paper/i })).toBeDisabled();
    });

    it("submits paper when abstract is in range", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      mockUseAuth.mockReturnValue(signedInAuth());
      mockGetCfpSubmission.mockResolvedValue(null);
      const Page = (await import("@/app/cfp/page")).default;
      render(<Page />);

      const abstract = Array.from({ length: 1600 }, () => "word").join(" ");
      await waitFor(() => {
        expect(document.getElementById("abstract")).toBeInTheDocument();
      });
      for (const [id, value] of [
        ["name", "Ada Lovelace"],
        ["school", "MIT"],
        ["department", "EECS"],
        ["advisor", "Prof. Example"],
        ["thesisTitle", "Fairness in ML"],
        ["abstract", abstract],
      ] as const) {
        fireEvent.change(document.getElementById(id)!, {
          target: { value, name: id },
        });
      }
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Submit Paper/i }),
        ).not.toBeDisabled();
      });
      await user.click(screen.getByRole("button", { name: /Submit Paper/i }));

      await waitFor(() => {
        expect(mockSubmitCfpProposal).toHaveBeenCalled();
      });
      expect(
        await screen.findByText(/Thanks for your submission/i),
      ).toBeInTheDocument();
    });
  });

  describe("badges page", () => {
    it("loads badge grid for signed-in users", async () => {
      const mockPush = jest.fn();
      jest.spyOn(require("next/navigation"), "useRouter").mockReturnValue({
        push: mockPush,
        replace: jest.fn(),
        back: jest.fn(),
        refresh: jest.fn(),
        prefetch: jest.fn(),
      });

      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch();
      const Page = (await import("@/app/badges/page")).default;
      render(<Page />);

      expect(await screen.findByText(/Achievement Badges/i)).toBeInTheDocument();
      expect(await screen.findByText(/Your Progress/i)).toBeInTheDocument();
      expect(screen.getByText(/total$/i)).toBeInTheDocument();
    });
  });

  describe("agents claim page", () => {
    function claimParams() {
      const params = Promise.resolve({ token: CLAIM_TOKEN });
      (
        params as Promise<{ token: string }> & {
          __testResolvedValue?: { token: string };
        }
      ).__testResolvedValue = { token: CLAIM_TOKEN };
      return params;
    }

    async function loadClaimPage() {
      const mod = await import("@/app/agents/claim/[token]/page");
      return { Page: mod.default, params: claimParams() };
    }

    it("shows invalid link UI when token lookup fails", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          success: false,
          error: "Token expired",
          hint: "Ask the agent owner for a fresh link.",
        }),
      );
      const { Page, params } = await loadClaimPage();
      render(<Page params={params} />);
      expect(await screen.findByText(/Invalid or Expired Link/i)).toBeInTheDocument();
      expect(screen.getByText(/Ask the agent owner/i)).toBeInTheDocument();
    });

    it("claims agent when signed in and requirements are met", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth({ displayName: "Wave Six" }));
      installSignedInFetch();
      const { Page, params } = await loadClaimPage();
      render(<Page params={params} />);

      expect(await screen.findByText("Wave Bot")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Claim This Agent/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/agents/claim/${CLAIM_TOKEN}`,
          expect.objectContaining({ method: "POST" }),
        );
      });
      expect(
        await screen.findByText(/Agent Claimed Successfully/i),
      ).toBeInTheDocument();
    });

    it("prompts sign-in when logged out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          agent: {
            id: "agent-wave6",
            name: "Wave Bot",
            status: "pending_claim",
          },
          canClaim: false,
        }),
      );
      const { Page, params } = await loadClaimPage();
      render(<Page params={params} />);

      expect(await screen.findByText("Wave Bot")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Sign In to Continue/i }),
      ).toHaveAttribute("href", `/login?redirect=/agents/claim/${CLAIM_TOKEN}`);
    });
  });
});
