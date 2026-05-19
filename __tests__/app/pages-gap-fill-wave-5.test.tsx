/**
 * @jest-environment jsdom
 *
 * Wave 5: interactive RTL coverage for mentorship, pair, hackathons, admin cohort.
 */
import "@/__tests__/app/_shared/page-test-setup";

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { doc, getDoc, addDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import { getMentorshipProfile } from "@/lib/mentorship/data";
import { getPairProfile, getAllActiveProfiles } from "@/lib/pair-programming/data";
import { getTopMatches } from "@/lib/pair-programming/matching";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";
import { SPORTS_HACK_2026_EVENT_ID } from "@/lib/sports-hack-2026";

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

jest.mock("@/components/NeedsWorkBanner", () => ({
  NeedsWorkBanner: () => null,
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMentorshipProfile = getMentorshipProfile as jest.Mock;
const mockGetPairProfile = getPairProfile as jest.Mock;
const mockGetAllActiveProfiles = getAllActiveProfiles as jest.Mock;
const mockGetTopMatches = getTopMatches as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;
const mockAddDoc = addDoc as jest.Mock;
const mockDeleteDoc = deleteDoc as jest.Mock;

const WAVE5_UID = "uid-wave5";
const PARTNER_UID = "partner-wave5";
const MATCH_MENTOR_UID = "match-mentor-1";
const REQUESTER_UID = "requester-wave5";
const PAIR_SESSION_ID = "sess-pair-wave5";

const hackASprintSignupUrl = `/api/hackathons/events/${HACK_A_SPRINT_2026_EVENT_ID}/signup`;
const sportsSignupUrl = `/api/hackathons/events/${SPORTS_HACK_2026_EVENT_ID}/signup`;

const activeMentorshipProfile = {
  userId: WAVE5_UID,
  role: "mentee" as const,
  expertise: ["TypeScript"],
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
  userId: WAVE5_UID,
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
  submissionId: "sub-wave5",
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

function authUser() {
  return makeAuthUser(WAVE5_UID);
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
    user: authUser(),
    userProfile: { displayName: "Wave Five", ...extraProfile },
    loading: false,
    signInWithGoogle: jest.fn(),
    signInWithGithub: jest.fn(),
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
    refreshUserProfile: jest.fn(),
  };
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
        data: () => ({
          displayName: "Partner Dev",
          photoURL: "https://example.com/avatar.png",
        }),
      };
    }
    if (path === `users/${MATCH_MENTOR_UID}`) {
      return {
        exists: () => true,
        data: () => ({ displayName: "Mentor Alex", photoURL: null }),
      };
    }
    if (path === `users/${REQUESTER_UID}`) {
      return {
        exists: () => true,
        data: () => ({ displayName: "Requester One", photoURL: null }),
      };
    }
    return { exists: () => false, data: () => undefined };
  });
}

function installSignedOutFetch() {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
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
        submissions: [hackASprintSubmission],
      });
    }
    if (url === hackASprintSignupUrl || url === sportsSignupUrl) {
      return jsonResponse({
        eventId: url.includes("sports") ? SPORTS_HACK_2026_EVENT_ID : HACK_A_SPRINT_2026_EVENT_ID,
        totalCount: 0,
        websiteSignupCount: 0,
        entries: [],
        creditTopN: 80,
        me: null,
      });
    }
    return jsonResponse({});
  }) as typeof fetch;
}

function installSignedInFetch(overrides: {
  hackASprintPhase?: string;
  canPeerVote?: boolean;
  hackASprintSignupMe?: Record<string, unknown> | null;
  profileVisibility?: Record<string, unknown>;
} = {}) {
  const {
    hackASprintPhase = "peerVotingOpen",
    canPeerVote = true,
    hackASprintSignupMe = null,
    profileVisibility = {
      hasGithub: true,
      githubUsername: "wavefive",
      hasDiscord: true,
      discordUsername: "wave#0001",
      visibility: { isPublic: true, showDiscord: true },
    },
  } = overrides;

  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.includes("/api/mentorship/matches")) {
      return jsonResponse({
        success: true,
        matches: [
          {
            userId: MATCH_MENTOR_UID,
            score: 85,
            reasons: ["Shared TypeScript focus", "Overlapping Monday mornings"],
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
    if (url.includes("/api/pair/request")) {
      if (method === "POST") {
        return jsonResponse({ success: true });
      }
      const type = url.includes("type=sent") ? "sent" : "received";
      if (type === "received") {
        return jsonResponse({
          success: true,
          requests: [
            {
              id: "req-wave5",
              fromUserId: REQUESTER_UID,
              toUserId: WAVE5_UID,
              sessionType: "code-review",
              message: "Want to review auth middleware.",
              status: "pending",
            },
          ],
        });
      }
      return jsonResponse({
        success: true,
        requests: [
          {
            id: "req-sent-1",
            fromUserId: WAVE5_UID,
            toUserId: PARTNER_UID,
            sessionType: "build-together",
            message: "Let's pair on hooks.",
            status: "pending",
          },
        ],
      });
    }
    if (url.includes("/api/pair/respond") && method === "POST") {
      return jsonResponse({ success: true, sessionId: PAIR_SESSION_ID });
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
    if (url.includes("/api/hackathons/showcase/hack-a-sprint-2026/me")) {
      return jsonResponse({
        phase: hackASprintPhase,
        signedUp: true,
        checkedIn: true,
        hasCompletedPeerVoting: false,
        prizeEligible: true,
        highScoreCount: 0,
        requiredHighScores: 1,
        participantEligible: true,
        judgeEligible: false,
        githubLogin: "wavefive",
      });
    }
    if (url.includes("/api/hackathons/showcase/hack-a-sprint-2026/credit-code")) {
      return jsonResponse({ eligible: false, reason: "Not in top band" });
    }
    if (
      url.includes("/api/hackathons/showcase/hack-a-sprint-2026/participant-score") &&
      method === "POST"
    ) {
      return jsonResponse({ success: true });
    }
    if (url === hackASprintSignupUrl) {
      if (method === "POST") {
        return jsonResponse({ ok: true });
      }
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
      return jsonResponse({
        eventId: SPORTS_HACK_2026_EVENT_ID,
        totalCount: 1,
        websiteSignupCount: 1,
        entries: [
          {
            rank: 1,
            userId: WAVE5_UID,
            displayName: "Wave Five",
            githubLogin: "wavefive",
            mergedPrCount: 2,
            signedUpAt: "2026-05-20T12:00:00.000Z",
            creditEligible: true,
            status: "confirmed",
            lumaRegistered: true,
          },
        ],
        creditTopN: 80,
        me: {
          signedUp: true,
          rank: 1,
          mergedPrCount: 2,
          signedUpAt: "2026-05-20T12:00:00.000Z",
          creditEligible: true,
          willBeLate: false,
          queuingForSpot: false,
          lumaRegistered: true,
        },
      });
    }
    if (url === "/api/profile/visibility") {
      if (method === "PATCH") {
        return jsonResponse({
          success: true,
          visibility: { isPublic: true, showDiscord: true },
        });
      }
      return jsonResponse({ success: true, profile: profileVisibility });
    }
    if (url.includes("/api/hackathons/team-dashboard")) {
      return jsonResponse({
        myTeam: {
          id: "team-wave5",
          hackathonId: "2026-05",
          memberIds: [WAVE5_UID, "member-2"],
          name: "Wave Runners",
          createdBy: WAVE5_UID,
          createdAt: "2026-05-01T12:00:00.000Z",
        },
        memberProfiles: {
          [WAVE5_UID]: {
            uid: WAVE5_UID,
            displayName: "Wave Five",
            photoURL: null,
            github: { login: "wavefive" },
          },
          "member-2": {
            uid: "member-2",
            displayName: "Teammate Two",
            photoURL: null,
          },
        },
        submission: {
          id: "sub-team",
          hackathonId: "2026-05",
          teamId: "team-wave5",
          repoUrl: "https://github.com/example/hackathon-repo",
          registeredBy: WAVE5_UID,
          registeredAt: "2026-05-10T12:00:00.000Z",
        },
        myInvites: [
          {
            id: "invite-wave5",
            fromUserId: "captain-1",
            toUserId: WAVE5_UID,
            teamId: "team-other",
            status: "pending",
            createdAt: "2026-05-09T12:00:00.000Z",
          },
        ],
        requestsToMyTeam: [],
      });
    }
    if (url.includes("/api/hackathons/pool-dashboard")) {
      return jsonResponse({
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
      });
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
    if (url.includes("/api/summer-cohort/admin/access")) {
      return jsonResponse({ allowed: true });
    }
    if (url.includes("/api/summer-cohort/admin/applications")) {
      return jsonResponse({
        applications: [
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
        ],
        total: 2,
      });
    }
    if (url.includes("/api/summer-cohort/admin/intake-aggregates")) {
      return jsonResponse(emptyAdminAggregates);
    }
    if (url.includes("/api/summer-cohort/votes?")) {
      return jsonResponse({ weekId: "week-1", counts: { "proj-a": 3 } });
    }
    return jsonResponse({});
  }) as typeof fetch;
}

describe("pages gap-fill wave 5", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    mockGetMentorshipProfile.mockResolvedValue(null);
    mockGetPairProfile.mockResolvedValue(null);
    mockGetAllActiveProfiles.mockResolvedValue([]);
    mockGetTopMatches.mockResolvedValue([]);
    mockAddDoc.mockResolvedValue({ id: "new-doc" });
    mockDeleteDoc.mockResolvedValue(undefined);
    installFirestoreDocs();
  });

  describe("mentorship page", () => {
    it("shows sign-in CTA when signed out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      installSignedOutFetch();
      const Page = (await import("@/app/mentorship/page")).default;
      render(<Page />);
      expect(await screen.findByText("Mentorship Matching")).toBeInTheDocument();
      expect(
        screen.getByText(/find a mentor or offer your expertise/i),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Sign In/i })).toHaveAttribute(
        "href",
        "/login",
      );
    });

    it("shows profile setup when signed in without a profile", async () => {
      mockUseAuth.mockReturnValue(signedInAuth());
      mockGetMentorshipProfile.mockResolvedValue(null);
      installSignedInFetch();
      const Page = (await import("@/app/mentorship/page")).default;
      render(<Page />);
      expect(
        await screen.findByText("Set Up Your Mentorship Profile"),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Save Profile/i })).toBeInTheDocument();
      expect(screen.getByText(/Tell us your role/i)).toBeInTheDocument();
    });

    it("sends a mentorship request from a match card", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      mockGetMentorshipProfile.mockResolvedValue(activeMentorshipProfile);
      installSignedInFetch();
      const Page = (await import("@/app/mentorship/page")).default;
      render(<Page />);

      await screen.findByText("Mentor Alex");
      await user.click(screen.getByRole("button", { name: /Request Mentorship/i }));

      const goalInput = screen.getByPlaceholderText(/Learn TypeScript/i);
      await user.type(goalInput, "System design");
      await user.keyboard("{Enter}");
      expect(screen.getByText("System design")).toBeInTheDocument();

      await user.type(
        screen.getByPlaceholderText(/Introduce yourself/i),
        "Would love weekly check-ins.",
      );
      await user.click(screen.getByRole("button", { name: /^Send Request$/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/mentorship/request",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining(MATCH_MENTOR_UID),
          }),
        );
      });
      expect(window.alert).toHaveBeenCalledWith("Mentorship request sent!");
    });
  });

  describe("pair page", () => {
    it("shows sign-in CTA when signed out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      installSignedOutFetch();
      const Page = (await import("@/app/pair/page")).default;
      render(<Page />);
      expect(
        await screen.findByText("Pair Programming Matchmaker"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/find your perfect pair programming partner/i),
      ).toBeInTheDocument();
    });

    it("renders matches and pending request banner when signed in", async () => {
      mockUseAuth.mockReturnValue(signedInAuth());
      mockGetPairProfile.mockResolvedValue(activePairProfile);
      mockGetAllActiveProfiles.mockResolvedValue([
        { ...activePairProfile, userId: PARTNER_UID },
      ]);
      mockGetTopMatches.mockResolvedValue([
        {
          userId: PARTNER_UID,
          score: 78,
          reasons: ["You teach React, they want to learn React"],
        },
      ]);
      installSignedInFetch();
      const Page = (await import("@/app/pair/page")).default;
      render(<Page />);

      await waitFor(() => {
        expect(screen.getByText(/1 pending request/i)).toBeInTheDocument();
        expect(screen.getByText("Partner Dev")).toBeInTheDocument();
        expect(screen.getByText(/78% match/)).toBeInTheDocument();
        expect(
          screen.getByRole("link", { name: /View requests/i }),
        ).toHaveAttribute("href", "/pair/requests");
      });
    });

    it("creates a pair request from the match card form", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      mockGetPairProfile.mockResolvedValue(activePairProfile);
      mockGetAllActiveProfiles.mockResolvedValue([
        { ...activePairProfile, userId: PARTNER_UID },
      ]);
      mockGetTopMatches.mockResolvedValue([
        {
          userId: PARTNER_UID,
          score: 78,
          reasons: ["Complementary React skills"],
        },
      ]);
      installSignedInFetch();
      const Page = (await import("@/app/pair/page")).default;
      render(<Page />);

      await screen.findByText("Partner Dev");
      await user.click(screen.getByRole("button", { name: /Send Pair Request/i }));

      await user.selectOptions(
        screen.getByRole("combobox"),
        screen.getByRole("option", { name: /Code Review Swap/i }),
      );
      await user.type(
        screen.getByPlaceholderText(/Send a message/i),
        "Free Saturday afternoon for a review swap.",
      );
      await user.click(screen.getByRole("button", { name: /^Send Request$/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/pair/request",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining(PARTNER_UID),
          }),
        );
      });
      expect(window.alert).toHaveBeenCalledWith("Pair request sent successfully!");
    });
  });

  describe("hack-a-sprint-2026 showcase page", () => {
    it("renders public gallery when signed out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      installSignedOutFetch();
      const Page = (await import("@/app/hackathons/hack-a-sprint-2026/page")).default;
      render(<Page />);

      await waitFor(() => {
        expect(screen.getByText(/Hack-a-Sprint 2026 — Submissions/i)).toBeInTheDocument();
        expect(screen.getByText("Sprint Demo")).toBeInTheDocument();
        expect(screen.getByText(/Sign in for peer scoring/i)).toBeInTheDocument();
        expect(
          screen.getByRole("link", { name: /hack-a-sprint-2026-submissions/i }),
        ).toHaveAttribute("href", expect.stringContaining("hack-a-sprint-2026-submissions"));
      });
    });

    it("submits a peer score for another builder's project", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(
        signedInAuth({ github: { login: "wavefive" } }),
      );
      installSignedInFetch({ hackASprintPhase: "peerVotingOpen", canPeerVote: true });
      const Page = (await import("@/app/hackathons/hack-a-sprint-2026/page")).default;
      render(<Page />);

      await screen.findByText("Sprint Demo");
      const scoreSelect = screen
        .getAllByRole("combobox")
        .find((el) => within(el.parentElement as HTMLElement).queryByText(/peer score/i));
      expect(scoreSelect).toBeTruthy();
      await user.selectOptions(scoreSelect!, "8");

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/hackathons/showcase/hack-a-sprint-2026/participant-score",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("sub-wave5"),
          }),
        );
      });
    });

    it("filters the gallery with search", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch({ hackASprintPhase: "resultsOpen", canPeerVote: false });
      const Page = (await import("@/app/hackathons/hack-a-sprint-2026/page")).default;
      render(<Page />);

      await screen.findByText("Sprint Demo");
      const search = screen.getByLabelText(/Search \(title or @github\)/i);
      await user.clear(search);
      await user.type(search, "zzz-no-match");
      expect(screen.queryByText("Sprint Demo")).not.toBeInTheDocument();

      await user.clear(search);
      await user.type(search, "sprint demo");
      expect(screen.getByText("Sprint Demo")).toBeInTheDocument();
    });
  });

  describe("hack-a-sprint-2026 signup page", () => {
    it("renders sign-in CTA when signed out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      installSignedOutFetch();
      const Page = (await import("@/app/hackathons/hack-a-sprint-2026/signup/page"))
        .default;
      render(<Page />);

      expect(
        await screen.findByText(/Hack-a-Sprint 2026 — website signup/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Sign in or create an account to claim your spot/i),
      ).toBeInTheDocument();
    });

    it("shows incomplete profile requirements when profile is not ready", async () => {
      mockUseAuth.mockReturnValue(
        signedInAuth({
          visibility: { isPublic: false, showDiscord: false },
        }),
      );
      installSignedInFetch({
        profileVisibility: {
          hasGithub: false,
          githubUsername: null,
          hasDiscord: false,
          discordUsername: null,
          visibility: { isPublic: false, showDiscord: false },
        },
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

      await waitFor(() => {
        expect(
          screen.getByText(/Complete your profile to sign up/i),
        ).toBeInTheDocument();
        expect(screen.getByText(/requirements met/i)).toBeInTheDocument();
        expect(screen.getByText(/Connect GitHub/i)).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /Complete requirements to sign up/i }),
        ).toBeDisabled();
      });
    });

    it("claims a spot when profile requirements are met", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(
        signedInAuth({
          github: { login: "wavefive" },
          discord: { username: "wave#0001" },
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

      const claimButton = await screen.findByRole("button", {
        name: /Claim my spot/i,
      });
      expect(claimButton).toBeEnabled();
      await user.click(claimButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          hackASprintSignupUrl,
          expect.objectContaining({ method: "POST" }),
        );
      });
    });
  });

  describe("hackathons team page", () => {
    it("asks visitors to sign in when signed out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      const Page = (await import("@/app/hackathons/team/page")).default;
      render(<Page />);
      expect(await screen.findByText("My team")).toBeInTheDocument();
      expect(
        screen.getByText(/Sign in to view and manage your team/i),
      ).toBeInTheDocument();
    });

    it("renders team roster and registered repo when signed in", async () => {
      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch();
      const Page = (await import("@/app/hackathons/team/page")).default;
      render(<Page />);

      await waitFor(() => {
        expect(screen.getByText(/Team members \(2\/3\)/i)).toBeInTheDocument();
        expect(screen.getByText("Teammate Two")).toBeInTheDocument();
        expect(screen.getByText(/Registered repo:/i)).toBeInTheDocument();
        expect(
          screen.getByRole("link", { name: /github.com\/example\/hackathon-repo/i }),
        ).toHaveAttribute("href", "https://github.com/example/hackathon-repo");
      });
    });

    it("accepts a pending team invite", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch();
      const Page = (await import("@/app/hackathons/team/page")).default;
      render(<Page />);

      const acceptButton = await screen.findByRole("button", { name: /^Accept$/i });
      await user.click(acceptButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/hackathons/invites/accept",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("invite-wave5"),
          }),
        );
      });
    });
  });

  describe("hackathons pool page", () => {
    it("asks visitors to sign in when signed out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      const Page = (await import("@/app/hackathons/pool/page")).default;
      render(<Page />);
      expect(await screen.findByText("Find a team")).toBeInTheDocument();
      expect(
        screen.getByText(/Sign in to join the pool/i),
      ).toBeInTheDocument();
    });

    it("joins the pool when eligible", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch();
      const Page = (await import("@/app/hackathons/pool/page")).default;
      render(<Page />);

      const joinButton = await screen.findByRole("button", { name: /Join pool/i });
      await user.click(joinButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/hackathons/pool/join",
          expect.objectContaining({ method: "POST" }),
        );
      });
    });

    it("shows pool members when user is in the pool", async () => {
      mockUseAuth.mockReturnValue(signedInAuth());
      global.fetch = jest.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/hackathons/pool-dashboard")) {
          return jsonResponse({
            poolEntries: [
              {
                userId: PARTNER_UID,
                hackathonId: "2026-05",
                joinedAt: "2026-05-01T12:00:00.000Z",
              },
            ],
            inPool: true,
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
          });
        }
        if (url.includes("/api/hackathons/eligibility")) {
          return jsonResponse({ eligible: true });
        }
        return jsonResponse({});
      }) as typeof fetch;

      const Page = (await import("@/app/hackathons/pool/page")).default;
      render(<Page />);

      await waitFor(() => {
        expect(screen.getByText(/You are in the pool/i)).toBeInTheDocument();
        expect(screen.getByText("Pool Partner")).toBeInTheDocument();
        expect(screen.getByText(/Open Slots/i)).toBeInTheDocument();
      });
    });
  });

  describe("sports-hack-2026 signup page", () => {
    it("renders signup CTA when signed out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      installSignedOutFetch();
      const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
        .default;
      render(<Page />);

      await waitFor(() => {
        expect(
          screen.getByText(/Sign in or create an account to claim your spot/i),
        ).toBeInTheDocument();
      });
      expect(global.fetch).toHaveBeenCalledWith(sportsSignupUrl, expect.any(Object));
    });

    it("shows signed-up leaderboard row when authenticated", async () => {
      mockUseAuth.mockReturnValue(
        signedInAuth({ github: { login: "wavefive" }, discord: { username: "wave#0001" } }),
      );
      installSignedInFetch();
      const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
        .default;
      render(<Page />);

      await waitFor(() => {
        expect(screen.getByText(/You are signed up/i)).toBeInTheDocument();
        expect(screen.getByText("Wave Five")).toBeInTheDocument();
      });
    });

    it("links to profile requirements when not signed up", async () => {
      mockUseAuth.mockReturnValue(
        signedInAuth({
          github: { login: "wavefive" },
          discord: { username: "wave#0001" },
          visibility: { isPublic: false, showDiscord: false },
        }),
      );
      installSignedInFetch({
        profileVisibility: {
          hasGithub: true,
          githubUsername: "wavefive",
          hasDiscord: true,
          discordUsername: "wave#0001",
          visibility: { isPublic: false, showDiscord: false },
        },
      });
      global.fetch = jest.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === sportsSignupUrl) {
          return jsonResponse({
            eventId: SPORTS_HACK_2026_EVENT_ID,
            totalCount: 0,
            websiteSignupCount: 0,
            entries: [],
            creditTopN: 80,
            me: {
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
          return jsonResponse({
            success: true,
            profile: {
              hasGithub: true,
              githubUsername: "wavefive",
              hasDiscord: true,
              discordUsername: "wave#0001",
              visibility: { isPublic: false, showDiscord: false },
            },
          });
        }
        return jsonResponse({});
      }) as typeof fetch;

      const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
        .default;
      render(<Page />);

      await waitFor(() => {
        expect(
          screen.getByText(/Complete your profile to sign up/i),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /Complete requirements to sign up/i }),
        ).toBeDisabled();
      });
    });
  });

  describe("admin summer-cohort page", () => {
    it("redirects when access is denied", async () => {
      mockUseAuth.mockReturnValue(signedInAuth());
      global.fetch = jest.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/summer-cohort/admin/access")) {
          return jsonResponse({ allowed: false });
        }
        return jsonResponse({});
      }) as typeof fetch;

      const Page = (await import("@/app/admin/summer-cohort/page")).default;
      render(<Page />);

      await waitFor(() => {
        expect(screen.queryByText("Summer cohort")).not.toBeInTheDocument();
      });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/summer-cohort/admin/access",
        expect.any(Object),
      );
    });

    it("loads applications and summary for maintainers", async () => {
      mockUseAuth.mockReturnValue(
        signedInAuth({ roles: ["maintainer"], email: "maintainer@example.com" }),
      );
      installSignedInFetch();
      const Page = (await import("@/app/admin/summer-cohort/page")).default;
      render(<Page />);

      await waitFor(() => {
        expect(screen.getByText("Summer cohort")).toBeInTheDocument();
        expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
        expect(screen.getByText("grace@example.com")).toBeInTheDocument();
        expect(screen.getByText(/application summary/i)).toBeInTheDocument();
      });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/summer-cohort/admin/access",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer /),
          }),
        }),
      );
    });

    it("filters applications by status", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(
        signedInAuth({ roles: ["maintainer"], email: "maintainer@example.com" }),
      );
      installSignedInFetch();
      const Page = (await import("@/app/admin/summer-cohort/page")).default;
      render(<Page />);

      await screen.findByText("Ada Lovelace");
      await user.click(screen.getByRole("button", { name: /^admitted$/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/summer-cohort/admin/applications?"),
          expect.any(Object),
        );
        const lastCall = (global.fetch as jest.Mock).mock.calls
          .map(([url]) => String(url))
          .filter((u) => u.includes("/api/summer-cohort/admin/applications"))
          .pop();
        expect(lastCall).toContain("status=admitted");
      });
    });
  });

  describe("pair requests page", () => {
    it("shows sign-in gate when signed out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      const Page = (await import("@/app/pair/requests/page")).default;
      render(<Page />);
      expect(await screen.findByRole("heading", { name: "Pair Requests" })).toBeInTheDocument();
      expect(
        screen.getByText(/Sign in to view your pair programming requests/i),
      ).toBeInTheDocument();
    });

    it("accepts a received request and navigates to the session", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch();
      const Page = (await import("@/app/pair/requests/page")).default;
      render(<Page />);

      await screen.findByText("Requester One");
      const acceptButton = screen.getByRole("button", { name: /^Accept$/i });
      await user.click(acceptButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/pair/respond",
          expect.objectContaining({
            method: "POST",
            body: expect.stringMatching(/req-wave5.*accept|accept.*req-wave5/s),
          }),
        );
      });
    });

    it("switches to sent requests tab", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(signedInAuth());
      installSignedInFetch();
      const Page = (await import("@/app/pair/requests/page")).default;
      render(<Page />);

      await screen.findByText("Received (1)");
      await user.click(screen.getByRole("button", { name: /Sent \(1\)/i }));

      expect(await screen.findByText(/Let's pair on hooks/i)).toBeInTheDocument();
      expect(screen.queryByText("Want to review auth middleware.")).not.toBeInTheDocument();
    });
  });
});
