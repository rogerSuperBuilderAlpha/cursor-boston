/* eslint-disable @next/next/no-img-element -- next/image mocked as img for RTL */
/**
 * @jest-environment jsdom
 *
 * Wave 4: deep renders for mentorship, pair, hackathons, live emcee, PyData admin.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { doc, getDoc } from "firebase/firestore";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useParams: () => ({ sessionId: "sess-pair-wave4" }),
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

jest.mock("@/lib/firebase", () => ({
  auth: {},
  db: {},
  storage: null,
  rtdb: null,
  app: null,
}));

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn((_, cb) => {
    cb(null);
    return jest.fn();
  }),
  getIdToken: jest.fn((user) => user?.getIdToken?.() ?? Promise.resolve("test-token")),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  GoogleAuthProvider: class {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  addDoc: jest.fn().mockResolvedValue({ id: "new-doc" }),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  getDoc: jest.fn().mockResolvedValue({ exists: () => false, data: () => undefined }),
  getDocs: jest.fn().mockResolvedValue({ docs: [], empty: true }),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  serverTimestamp: () => "__ts",
  Timestamp: {
    fromMillis: (ms: number) => ({ toDate: () => new Date(ms) }),
    fromDate: (date: Date) => ({ toDate: () => date }),
  },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => require("react").createElement("a", { href }, children),
}));

jest.mock("@/components/SectionHelp", () => ({
  SectionHelp: () => null,
}));

jest.mock("@/components/Avatar", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({
    user: null,
    userProfile: null,
    loading: false,
    signInWithGoogle: jest.fn(),
    signInWithGithub: jest.fn(),
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import { getMentorshipProfile } from "@/lib/mentorship/data";
import { getPairProfile, getAllActiveProfiles } from "@/lib/pair-programming/data";
import { getTopMatches } from "@/lib/pair-programming/matching";
import { useLiveSession } from "@/lib/live-sessions/client";
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

jest.mock("@/components/NeedsWorkBanner", () => ({
  NeedsWorkBanner: () => null,
}));

jest.mock("@/lib/live-sessions/client", () => {
  const actual = jest.requireActual<typeof import("@/lib/live-sessions/client")>(
    "@/lib/live-sessions/client",
  );
  return {
    ...actual,
    useLiveSession: jest.fn(),
    useLiveTimerAudioAlerts: () => ({
      audioEnabled: false,
      audioSupported: false,
      enableAudio: jest.fn(),
    }),
  };
});

jest.mock("qrcode", () => ({
  toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,qr"),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ""} />,
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMentorshipProfile = getMentorshipProfile as jest.Mock;
const mockGetPairProfile = getPairProfile as jest.Mock;
const mockGetAllActiveProfiles = getAllActiveProfiles as jest.Mock;
const mockGetTopMatches = getTopMatches as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;
const mockUseLiveSession = useLiveSession as jest.Mock;

const WAVE4_UID = "uid-wave4";
const PARTNER_UID = "partner-wave4";
const PAIR_SESSION_ID = "sess-pair-wave4";
const LIVE_SESSION_ID = "sess-live-wave4";
const sportsSignupUrl = `/api/hackathons/events/${SPORTS_HACK_2026_EVENT_ID}/signup`;

const activeMentorshipProfile = {
  userId: WAVE4_UID,
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
  userId: WAVE4_UID,
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
  submissionId: "sub-wave4",
  githubLogin: "builder",
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

const mockLiveSession = {
  id: LIVE_SESSION_ID,
  status: "live" as const,
  title: "Boston Lightning Talks",
  createdAtMs: Date.now(),
  updatedAtMs: Date.now(),
  emceeUid: WAVE4_UID,
  emceeName: "Wave Four",
  audiencePath: `/live/${LIVE_SESSION_ID}`,
  emceePath: `/live/${LIVE_SESSION_ID}/emcee`,
  currentSpeaker: {
    entryId: "entry-1",
    speakerName: "Alex Rivera",
    talkTitle: "Agents in production",
  },
  timer: {
    status: "running" as const,
    durationSeconds: 300,
    remainingSeconds: 240,
    startedAtMs: Date.now() - 60_000,
    pausedAtMs: null,
    warningThresholds: [60, 30],
  },
  history: [],
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
  return makeAuthUser(WAVE4_UID);
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
    userProfile: { displayName: "Wave Four", ...extraProfile },
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
    if (path === `users/match-mentor-1`) {
      return {
        exists: () => true,
        data: () => ({ displayName: "Mentor Alex", photoURL: null }),
      };
    }
    if (path === `pair_sessions/${PAIR_SESSION_ID}`) {
      return {
        exists: () => true,
        id: PAIR_SESSION_ID,
        data: () => ({
          participantIds: [WAVE4_UID, PARTNER_UID],
          sessionType: "build-together",
          status: "in-progress",
          notes: {},
        }),
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
    if (url === sportsSignupUrl) {
      return jsonResponse({
        eventId: SPORTS_HACK_2026_EVENT_ID,
        totalCount: 1,
        websiteSignupCount: 1,
        entries: [],
        creditTopN: 80,
        me: null,
      });
    }
    return jsonResponse({});
  }) as typeof fetch;
}

function installSignedInFetch() {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/mentorship/matches")) {
      return jsonResponse({
        success: true,
        matches: [
          {
            userId: "match-mentor-1",
            score: 85,
            reasons: ["Shared TypeScript focus", "Overlapping Monday mornings"],
          },
        ],
      });
    }
    if (url.includes("/api/pair/request")) {
      return jsonResponse({
        success: true,
        requests: [
          {
            id: "req-1",
            fromUserId: "other-1",
            toUserId: WAVE4_UID,
            sessionType: "code-review",
            message: "Want to review auth middleware.",
            status: "pending",
          },
        ],
      });
    }
    if (url.includes("/api/hackathons/showcase/hack-a-sprint-2026/submissions")) {
      return jsonResponse({
        phase: "submissionOpen",
        viewer: {
          checkedIn: true,
          signedUp: true,
          hasCompletedPeerVoting: false,
          judgeEligible: false,
          isJudge: false,
          peerScoresRevealed: false,
          myParticipantScores: {},
          canPeerVote: true,
          isSubmitter: false,
        },
        submissions: [hackASprintSubmission],
      });
    }
    if (url.includes("/api/hackathons/showcase/hack-a-sprint-2026/me")) {
      return jsonResponse({
        phase: "submissionOpen",
        signedUp: true,
        checkedIn: true,
        hasCompletedPeerVoting: false,
        prizeEligible: true,
        highScoreCount: 1,
        requiredHighScores: 1,
        participantEligible: true,
        judgeEligible: false,
        githubLogin: "builder",
      });
    }
    if (url.includes("/api/hackathons/showcase/hack-a-sprint-2026/credit-code")) {
      return jsonResponse({
        eligible: true,
        creditUrl: "https://cursor.com/redeem/demo",
      });
    }
    if (url.includes("/api/hackathons/team-dashboard")) {
      return jsonResponse({
        myTeam: {
          id: "team-wave4",
          hackathonId: "2026-05",
          memberIds: [WAVE4_UID, "member-2", "member-3"],
          name: "Wave Runners",
          createdBy: WAVE4_UID,
          createdAt: "2026-05-01T12:00:00.000Z",
        },
        memberProfiles: {
          [WAVE4_UID]: {
            uid: WAVE4_UID,
            displayName: "Wave Four",
            photoURL: null,
            github: { login: "wavefour" },
          },
          "member-2": {
            uid: "member-2",
            displayName: "Teammate Two",
            photoURL: null,
          },
          "member-3": {
            uid: "member-3",
            displayName: "Teammate Three",
            photoURL: null,
          },
        },
        submission: {
          id: "sub-team",
          hackathonId: "2026-05",
          teamId: "team-wave4",
          repoUrl: "https://github.com/example/hackathon-repo",
          registeredBy: WAVE4_UID,
          registeredAt: "2026-05-10T12:00:00.000Z",
        },
        myInvites: [],
        requestsToMyTeam: [],
      });
    }
    if (url === sportsSignupUrl) {
      return jsonResponse({
        eventId: SPORTS_HACK_2026_EVENT_ID,
        totalCount: 2,
        websiteSignupCount: 2,
        entries: [
          {
            rank: 1,
            userId: WAVE4_UID,
            displayName: "Wave Four",
            githubLogin: "wavefour",
            mergedPrCount: 4,
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
          mergedPrCount: 4,
          signedUpAt: "2026-05-20T12:00:00.000Z",
          creditEligible: true,
          willBeLate: false,
          queuingForSpot: false,
          lumaRegistered: true,
        },
      });
    }
    if (url === "/api/profile/visibility") {
      return jsonResponse({
        success: true,
        profile: {
          hasGithub: true,
          githubUsername: "wavefour",
          hasDiscord: true,
          discordUsername: "wave#0001",
          visibility: { isPublic: true, showDiscord: true },
        },
      });
    }
    if (url === "/api/events/pydata-2026/admin/list") {
      return jsonResponse({
        total: 2,
        counts: { "awaiting-badge": 1, "checked-in": 1 },
        capacity: 150,
        inCapCount: 1,
        waitlistCount: 1,
        registrations: [
          {
            uid: "reg-1",
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@example.com",
            phone: "555-0100",
            organization: "Analytical Engines",
            status: "checked-in",
            createdAt: 1_715_500_000_000,
            inCap: true,
          },
          {
            uid: "reg-2",
            firstName: "Grace",
            lastName: "Hopper",
            email: "grace@example.com",
            phone: "",
            organization: "US Navy",
            status: "awaiting-badge",
            createdAt: 1_715_600_000_000,
            inCap: false,
          },
        ],
      });
    }
    if (url.includes(`/api/live/${LIVE_SESSION_ID}/control`)) {
      return jsonResponse({ ok: true });
    }
    return jsonResponse({});
  }) as typeof fetch;
}

function liveSessionParams() {
  const params = Promise.resolve({ sessionId: LIVE_SESSION_ID });
  (
    params as Promise<{ sessionId: string }> & {
      __testResolvedValue: { sessionId: string };
    }
  ).__testResolvedValue = { sessionId: LIVE_SESSION_ID };
  return params;
}

describe("pages gap-fill wave 4", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMentorshipProfile.mockResolvedValue(null);
    mockGetPairProfile.mockResolvedValue(null);
    mockGetAllActiveProfiles.mockResolvedValue([]);
    mockGetTopMatches.mockResolvedValue([]);
    installFirestoreDocs();
    mockUseLiveSession.mockReturnValue({
      session: null,
      queue: [],
      loading: true,
      error: null,
    });
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

    it("renders active profile summary and match cards when signed in", async () => {
      mockUseAuth.mockReturnValue(signedInAuth());
      mockGetMentorshipProfile.mockResolvedValue(activeMentorshipProfile);
      installSignedInFetch();
      const Page = (await import("@/app/mentorship/page")).default;
      render(<Page />);
      await waitFor(() => {
        expect(screen.getByText("Mentorship Matching")).toBeInTheDocument();
        expect(screen.getByText("Mentee")).toBeInTheDocument();
        expect(screen.getByText("Mentor Alex")).toBeInTheDocument();
        expect(screen.getByText(/85% match/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Request Mentorship/i })).toBeInTheDocument();
      });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/mentorship/matches",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer /),
          }),
        }),
      );
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

    it("renders matches and pending requests when signed in with profile", async () => {
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
        expect(screen.getByText("Pair Programming Matchmaker")).toBeInTheDocument();
        expect(screen.getByText(/1 pending request/i)).toBeInTheDocument();
        expect(screen.getByText("Partner Dev")).toBeInTheDocument();
        expect(screen.getByText(/78% match/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Send Pair Request/i })).toBeInTheDocument();
      });
    });
  });

  describe("hack-a-sprint-2026 page", () => {
    it("renders public gallery without auth-only panels when signed out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      installSignedOutFetch();
      const Page = (await import("@/app/hackathons/hack-a-sprint-2026/page")).default;
      render(<Page />);
      await waitFor(() => {
        expect(screen.getByText(/Hack-a-Sprint 2026 — Submissions/i)).toBeInTheDocument();
        expect(screen.getByText("Sprint Demo")).toBeInTheDocument();
        expect(screen.getByText(/Sign in for peer scoring/i)).toBeInTheDocument();
      });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/showcase/hack-a-sprint-2026/submissions",
        expect.objectContaining({ headers: {} }),
      );
    });

    it("loads me, credit code, and signed-in eligibility when authenticated", async () => {
      mockUseAuth.mockReturnValue(
        signedInAuth({
          github: { login: "builder" },
          cursor: { apiKeyFingerprint: "cur_abcd", monthlyCapUsd: 20 },
        }),
      );
      installSignedInFetch();
      const Page = (await import("@/app/hackathons/hack-a-sprint-2026/page")).default;
      render(<Page />);
      await waitFor(() => {
        expect(screen.getByText("Sprint Demo")).toBeInTheDocument();
        expect(screen.getByText(/Build & submit/i)).toBeInTheDocument();
      });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/showcase/hack-a-sprint-2026/me",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer /),
          }),
        }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/showcase/hack-a-sprint-2026/credit-code",
        expect.any(Object),
      );
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
        expect(screen.getByText(/Team members \(3\/3\)/i)).toBeInTheDocument();
        expect(screen.getByText("Teammate Two")).toBeInTheDocument();
        expect(screen.getByText(/Registered repo:/i)).toBeInTheDocument();
        expect(
          screen.getByDisplayValue("https://github.com/example/hackathon-repo"),
        ).toBeInTheDocument();
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/hackathons/team-dashboard"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer /),
          }),
        }),
      );
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
        signedInAuth({ github: { login: "wavefour" }, discord: { username: "wave#0001" } }),
      );
      installSignedInFetch();
      const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
        .default;
      render(<Page />);
      await waitFor(() => {
        expect(screen.getByText(/You are signed up/i)).toBeInTheDocument();
        expect(screen.getByText("Wave Four")).toBeInTheDocument();
      });
    });
  });

  describe("pair session detail page", () => {
    it("shows sign-in gate when signed out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      const Page = (await import("@/app/pair/[sessionId]/page")).default;
      render(<Page />);
      expect(await screen.findByText("Session Details")).toBeInTheDocument();
      expect(screen.getByText(/Sign in to view session details/i)).toBeInTheDocument();
    });

    it("renders in-progress session notes for participants", async () => {
      mockUseAuth.mockReturnValue(signedInAuth());
      const Page = (await import("@/app/pair/[sessionId]/page")).default;
      render(<Page />);
      await waitFor(() => {
        expect(screen.getByText("Pair Programming Session")).toBeInTheDocument();
        expect(screen.getByText("Build Together")).toBeInTheDocument();
        expect(screen.getByText("in-progress")).toBeInTheDocument();
        expect(screen.getByText("Partner Dev")).toBeInTheDocument();
        expect(screen.getByLabelText(/What We Worked On/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Complete Session/i })).toBeInTheDocument();
      });
    });
  });

  describe("live emcee page", () => {
    it("shows sign-in prompt when signed out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      mockUseLiveSession.mockReturnValue({
        session: mockLiveSession,
        queue: [],
        loading: false,
        error: null,
      });
      const Page = (await import("@/app/live/[sessionId]/emcee/page")).default;
      render(<Page params={liveSessionParams()} />);
      expect(await screen.findByText("Emcee Controls")).toBeInTheDocument();
      expect(
        screen.getByText(/Sign in to manage this live session/i),
      ).toBeInTheDocument();
    });

    it("renders emcee controls for the session owner", async () => {
      mockUseAuth.mockReturnValue(signedInAuth());
      mockUseLiveSession.mockReturnValue({
        session: mockLiveSession,
        queue: [
          {
            id: "entry-queued",
            sessionId: LIVE_SESSION_ID,
            userId: "speaker-1",
            speakerName: "Jamie Lee",
            speakerPhotoUrl: null,
            talkTitle: "Realtime queues",
            durationMinutes: 5,
            status: "queued",
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
          },
        ],
        loading: false,
        error: null,
      });
      installSignedInFetch();
      const Page = (await import("@/app/live/[sessionId]/emcee/page")).default;
      render(<Page params={liveSessionParams()} />);
      await waitFor(() => {
        expect(screen.getByText("Emcee Panel")).toBeInTheDocument();
        expect(screen.getByText("Boston Lightning Talks")).toBeInTheDocument();
        expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Start Next/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Pause/i })).toBeInTheDocument();
      });
    });
  });

  describe("pydata admin page", () => {
    it("shows admin sign-in gate when signed out", async () => {
      mockUseAuth.mockReturnValue(signedOutAuth());
      const Page = (await import("@/app/events/cursor-boston-pydata-2026/admin/page"))
        .default;
      render(<Page />);
      expect(
        await screen.findByText(/Sign in as an admin to view the registration list/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/PyData × Cursor Boston — Registrations/i),
      ).toBeInTheDocument();
    });

    it("renders cap stats and registration table for admins", async () => {
      mockUseAuth.mockReturnValue(signedInAuth({ isAdmin: true }));
      installSignedInFetch();
      const Page = (await import("@/app/events/cursor-boston-pydata-2026/admin/page"))
        .default;
      render(<Page />);
      await waitFor(() => {
        expect(screen.getByText(/In cap \(top 150\)/i)).toBeInTheDocument();
        expect(screen.getByText("Ada Lovelace", { exact: false })).toBeInTheDocument();
        expect(screen.getByText("grace@example.com")).toBeInTheDocument();
        expect(screen.getAllByText("Waitlist").length).toBeGreaterThan(0);
        expect(screen.getByRole("button", { name: /CSV for Moderna/i })).toBeInTheDocument();
      });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/events/pydata-2026/admin/list",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer /),
          }),
        }),
      );
    });
  });
});
