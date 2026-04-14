/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/hackathons/showcase/hack-a-sprint-2026/submissions/route";
import { getOptionalVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getAllHackASprint2026ParticipantScoreDocs } from "@/lib/hackathon-asprint-2026-state";
import { userIsHackASprint2026JudgeFromUserData } from "@/lib/hackathon-showcase-admin";
import { profileMatchesHackathonJudgeCheckinException } from "@/lib/hackathon-event-signup";
import { fetchShowcaseSubmissionsFromGitHub } from "@/lib/hackathon-showcase";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";

jest.mock("@/lib/server-auth", () => ({
  getOptionalVerifiedUser: jest.fn(),
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
  getAllHackASprint2026ParticipantScoreDocs: jest.fn(),
}));

jest.mock("@/lib/hackathon-showcase-admin", () => ({
  userIsHackASprint2026JudgeFromUserData: jest.fn(),
}));

jest.mock("@/lib/hackathon-event-signup", () => ({
  ...jest.requireActual("@/lib/hackathon-event-signup"),
  profileMatchesHackathonJudgeCheckinException: jest.fn(),
}));

const mockGetOptionalUser = getOptionalVerifiedUser as jest.MockedFunction<
  typeof getOptionalVerifiedUser
>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockFetchSubmissions =
  fetchShowcaseSubmissionsFromGitHub as jest.MockedFunction<
    typeof fetchShowcaseSubmissionsFromGitHub
  >;
const mockPhase = getHackASprint2026Phase as jest.MockedFunction<
  typeof getHackASprint2026Phase
>;
const mockAllParticipantDocs =
  getAllHackASprint2026ParticipantScoreDocs as jest.MockedFunction<
    typeof getAllHackASprint2026ParticipantScoreDocs
  >;
const mockJudgeFromProfile = userIsHackASprint2026JudgeFromUserData as jest.MockedFunction<
  typeof userIsHackASprint2026JudgeFromUserData
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

function makeSnap(exists: boolean, data?: Record<string, unknown>) {
  return {
    exists,
    data: () => data ?? {},
  };
}

/** Participant scores doc: incomplete ballot = only own key; complete = includes bob-proj. */
let participantScoresPayload: Record<string, number> = {};

function buildMockDb() {
  let getAllCall = 0;
  const getAll = jest.fn().mockImplementation(() => {
    getAllCall += 1;
    if (getAllCall === 1) {
      return Promise.resolve([
        makeSnap(true, { checkedInAt: new Date() }),
        makeSnap(true, { github: { login: "alice" } }),
      ]);
    }
    return Promise.resolve([
      makeScoreSnap({ aiScore: 9, aiReasoning: "Strong", peerVoteCount: 2 }),
      makeScoreSnap({ aiScore: 6, aiReasoning: "Fine", peerVoteCount: 1 }),
    ]);
  });

  const participantGet = jest.fn().mockImplementation(() =>
    Promise.resolve(
      makeSnap(true, {
        scores: participantScoresPayload,
      })
    )
  );

  const db = {
    collection: jest.fn((name: string) => ({
      doc: jest.fn((id: string) => {
        if (name === "hackathonASprint2026ParticipantScores") {
          return { get: participantGet };
        }
        return {};
      }),
    })),
    getAll,
  };

  return { db, getAll, participantGet };
}

function makeScoreSnap(data: Record<string, unknown>) {
  return { exists: true, data: () => data };
}

function makeGetRequest() {
  return new NextRequest(
    "http://localhost/api/hackathons/showcase/hack-a-sprint-2026/submissions"
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  participantScoresPayload = {};
  mockGetOptionalUser.mockResolvedValue({
    uid: "u1",
    email: "viewer@example.com",
  } as Awaited<ReturnType<typeof getOptionalVerifiedUser>>);
  mockPhase.mockReturnValue("peerVotingOpen");
  mockFetchSubmissions.mockResolvedValue(FIXTURE_SUBMISSIONS);
  mockJudgeFromProfile.mockReturnValue(false);
  mockJudgeCheckinBypass.mockReturnValue(false);
  mockAllParticipantDocs.mockResolvedValue([]);

  const { db } = buildMockDb();
  mockGetAdminDb.mockReturnValue(db as never);
});

describe("GET /api/hackathons/showcase/hack-a-sprint-2026/submissions", () => {
  it("returns 200 for unauthenticated public gallery", async () => {
    mockGetOptionalUser.mockResolvedValueOnce(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { viewer: { checkedIn: boolean }; submissions: unknown[] };
    expect(body.viewer.checkedIn).toBe(false);
    expect(Array.isArray(body.submissions)).toBe(true);
  });

  it("strips AI and peer fields for a submitter who has not finished peer voting", async () => {
    participantScoresPayload = { "alice-proj": 8 };
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
    participantScoresPayload = { "bob-proj": 9 };
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
    participantScoresPayload = { "alice-proj": 8 };
    mockJudgeFromProfile.mockReturnValue(true);
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
    participantScoresPayload = { "alice-proj": 8 };
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
