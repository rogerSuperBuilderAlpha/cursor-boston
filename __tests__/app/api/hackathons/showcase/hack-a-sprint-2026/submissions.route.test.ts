/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/hackathons/showcase/hack-a-sprint-2026/submissions/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  userIsCheckedInForHackASprint2026,
  userHasHackASprint2026Signup,
  userHackASprint2026PeerVoteComplete,
  getParticipantScoresForUser,
  getAllHackASprint2026ParticipantScoreDocs,
} from "@/lib/hackathon-asprint-2026-state";
import { userIsHackASprint2026Judge } from "@/lib/hackathon-showcase-admin";
import { profileMatchesHackathonJudgeCheckinException } from "@/lib/hackathon-event-signup";
import { fetchShowcaseSubmissionsFromGitHub } from "@/lib/hackathon-showcase";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/hackathon-showcase", () => ({
  fetchShowcaseSubmissionsFromGitHub: jest.fn(),
  getJudgeUidSet: jest.fn(() => new Set<string>()),
}));

jest.mock("@/lib/hackathon-asprint-2026-schedule", () => ({
  getHackASprint2026Phase: jest.fn(),
}));

jest.mock("@/lib/hackathon-asprint-2026-state", () => ({
  ...jest.requireActual("@/lib/hackathon-asprint-2026-state"),
  userIsCheckedInForHackASprint2026: jest.fn(),
  userHasHackASprint2026Signup: jest.fn(),
  userHackASprint2026PeerVoteComplete: jest.fn(),
  getParticipantScoresForUser: jest.fn(),
  getAllHackASprint2026ParticipantScoreDocs: jest.fn(),
}));

jest.mock("@/lib/hackathon-showcase-admin", () => ({
  userIsHackASprint2026Judge: jest.fn(),
}));

jest.mock("@/lib/hackathon-event-signup", () => ({
  ...jest.requireActual("@/lib/hackathon-event-signup"),
  profileMatchesHackathonJudgeCheckinException: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockFetchSubmissions =
  fetchShowcaseSubmissionsFromGitHub as jest.MockedFunction<
    typeof fetchShowcaseSubmissionsFromGitHub
  >;
const mockPhase = getHackASprint2026Phase as jest.MockedFunction<
  typeof getHackASprint2026Phase
>;
const mockCheckedIn = userIsCheckedInForHackASprint2026 as jest.MockedFunction<
  typeof userIsCheckedInForHackASprint2026
>;
const mockSignedUp = userHasHackASprint2026Signup as jest.MockedFunction<
  typeof userHasHackASprint2026Signup
>;
const mockPeerComplete = userHackASprint2026PeerVoteComplete as jest.MockedFunction<
  typeof userHackASprint2026PeerVoteComplete
>;
const mockGetParticipantScores = getParticipantScoresForUser as jest.MockedFunction<
  typeof getParticipantScoresForUser
>;
const mockAllParticipantDocs =
  getAllHackASprint2026ParticipantScoreDocs as jest.MockedFunction<
    typeof getAllHackASprint2026ParticipantScoreDocs
  >;
const mockIsJudge = userIsHackASprint2026Judge as jest.MockedFunction<
  typeof userIsHackASprint2026Judge
>;
const mockJudgeCheckinBypass =
  profileMatchesHackathonJudgeCheckinException as jest.MockedFunction<
    typeof profileMatchesHackathonJudgeCheckinException
  >;

const FIXTURE_SUBMISSIONS = [
  {
    submissionId: "alice-proj",
    githubLogin: "alice",
    payload: {
      projectRepoUrl: "https://github.com/alice/p",
      title: "Alpha",
      description: "d",
      loomVideoUrl: "",
    },
  },
  {
    submissionId: "bob-proj",
    githubLogin: "bob",
    payload: {
      projectRepoUrl: "https://github.com/bob/p",
      title: "Beta",
      description: "d",
      loomVideoUrl: "",
    },
  },
];

function makeScoreSnap(data: Record<string, unknown>) {
  return { exists: true, data: () => data };
}

function buildMockDb() {
  const getAll = jest.fn().mockResolvedValue([
    makeScoreSnap({ aiScore: 9, aiReasoning: "Strong", peerVoteCount: 2 }),
    makeScoreSnap({ aiScore: 6, aiReasoning: "Fine", peerVoteCount: 1 }),
  ]);

  const db = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({})),
    })),
    getAll,
  };

  const userGet = jest.fn().mockResolvedValue({
    exists: true,
    data: () => ({ github: { login: "viewergh" } }),
  });

  (db.collection as jest.Mock).mockImplementation((name: string) => ({
    doc: jest.fn((id: string) => {
      if (name === "users" && id === "u1") {
        return { get: userGet };
      }
      return { get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }) };
    }),
  }));

  return { db, getAll, userGet };
}

function makeGetRequest() {
  return new NextRequest(
    "http://localhost/api/hackathons/showcase/hack-a-sprint-2026/submissions"
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetVerifiedUser.mockResolvedValue({
    uid: "u1",
    email: "viewer@example.com",
  } as Awaited<ReturnType<typeof getVerifiedUser>>);
  mockPhase.mockReturnValue("peerVotingOpen");
  mockFetchSubmissions.mockResolvedValue(FIXTURE_SUBMISSIONS);
  mockCheckedIn.mockResolvedValue(true);
  mockSignedUp.mockResolvedValue(true);
  mockIsJudge.mockResolvedValue(false);
  mockJudgeCheckinBypass.mockReturnValue(false);
  mockPeerComplete.mockResolvedValue(false);
  mockGetParticipantScores.mockResolvedValue({ "alice-proj": 8 });
  mockAllParticipantDocs.mockResolvedValue([]);

  const { db } = buildMockDb();
  mockGetAdminDb.mockReturnValue(db as never);
});

describe("GET /api/hackathons/showcase/hack-a-sprint-2026/submissions", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValueOnce(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("strips AI and peer fields for a participant who has not finished peer voting", async () => {
    mockPeerComplete.mockResolvedValue(false);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      viewer: {
        hasCompletedPeerVoting: boolean;
        peerScoresRevealed: boolean;
        isJudge: boolean;
      };
      submissions: Array<{
        aiScore: number | null;
        aiRank: number | null;
        aiReasoning: string | null;
        peerAverage: number | null;
        peerVoteCount: number | null;
        judgeAverage: number | null;
        rawScore: number | null;
        myParticipantScore: number | null;
      }>;
    };

    expect(body.viewer.hasCompletedPeerVoting).toBe(false);
    expect(body.viewer.peerScoresRevealed).toBe(false);
    expect(body.viewer.isJudge).toBe(false);

    expect(body.submissions).toHaveLength(2);
    for (const row of body.submissions) {
      expect(row.aiScore).toBeNull();
      expect(row.aiRank).toBeNull();
      expect(row.aiReasoning).toBeNull();
      expect(row.peerAverage).toBeNull();
      expect(row.peerVoteCount).toBeNull();
      expect(row.judgeAverage).toBeNull();
      expect(row.rawScore).toBeNull();
    }
    const alice = body.submissions.find((s) => s.myParticipantScore != null);
    expect(alice?.myParticipantScore).toBe(8);
  });

  it("includes AI and peer fields after peer voting is complete", async () => {
    mockPeerComplete.mockResolvedValue(true);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      viewer: { peerScoresRevealed: boolean };
      submissions: Array<{
        submissionId: string;
        aiScore: number | null;
        aiReasoning: string | null;
      }>;
    };

    expect(body.viewer.peerScoresRevealed).toBe(true);
    const byId = new Map(body.submissions.map((s) => [s.submissionId, s]));
    expect(byId.get("alice-proj")?.aiScore).toBe(9);
    expect(byId.get("alice-proj")?.aiReasoning).toBe("Strong");
    expect(byId.get("bob-proj")?.aiScore).toBe(6);
  });

  it("reveals scores for judges even when peer voting is incomplete", async () => {
    mockPeerComplete.mockResolvedValue(false);
    mockIsJudge.mockResolvedValue(true);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      viewer: { peerScoresRevealed: boolean; isJudge: boolean };
      submissions: Array<{ aiScore: number | null; aiReasoning: string | null }>;
    };

    expect(body.viewer.isJudge).toBe(true);
    expect(body.viewer.peerScoresRevealed).toBe(true);
    expect(body.submissions.some((s) => s.aiScore != null)).toBe(true);
    expect(body.submissions.some((s) => s.aiReasoning)).toBe(true);
  });

  it("reveals scores when organizer check-in bypass applies", async () => {
    mockPeerComplete.mockResolvedValue(false);
    mockJudgeCheckinBypass.mockReturnValue(true);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      viewer: { peerScoresRevealed: boolean; isJudge: boolean };
      submissions: Array<{ aiScore: number | null }>;
    };

    expect(body.viewer.isJudge).toBe(true);
    expect(body.viewer.peerScoresRevealed).toBe(true);
    expect(body.submissions.every((s) => s.aiScore != null)).toBe(true);
  });
});
