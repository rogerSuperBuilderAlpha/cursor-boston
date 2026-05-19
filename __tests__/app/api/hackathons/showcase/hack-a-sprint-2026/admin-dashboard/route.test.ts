/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — Hack-a-Sprint 2026 admin dashboard route.
 */
import { GET } from "@/app/api/hackathons/showcase/hack-a-sprint-2026/admin-dashboard/route";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import {
  fetchShowcaseSubmissionsFromGitHub,
  getJudgeUidSet,
} from "@/lib/hackathon-showcase";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import {
  getAllHackASprint2026ParticipantScoreDocs,
  resolveVoterGithubByUid,
} from "@/lib/hackathon-asprint-2026-state";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "test-client"),
  checkRateLimit: jest.fn(() => ({ success: true, retryAfter: 0 })),
  rateLimitConfigs: { hackathonShowcaseVote: { windowMs: 60_000, maxRequests: 30 } },
}));

jest.mock("@/lib/hackathon-showcase", () => ({
  HACK_A_SPRINT_2026_EVENT_ID: "hack-a-sprint-2026",
  fetchShowcaseSubmissionsFromGitHub: jest.fn(),
  getJudgeUidSet: jest.fn(),
}));

jest.mock("@/lib/hackathon-asprint-2026-schedule", () => ({
  getHackASprint2026Phase: jest.fn(),
}));

jest.mock("@/lib/hackathon-asprint-2026-state", () => ({
  hackASprint2026ScoreDocId: jest.fn(
    (submissionId: string) => `hack-a-sprint-2026__${submissionId.toLowerCase()}`,
  ),
  getAllHackASprint2026ParticipantScoreDocs: jest.fn(),
  resolveVoterGithubByUid: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockFetchSubmissions = fetchShowcaseSubmissionsFromGitHub as jest.MockedFunction<
  typeof fetchShowcaseSubmissionsFromGitHub
>;
const mockGetJudgeUidSet = getJudgeUidSet as jest.MockedFunction<typeof getJudgeUidSet>;
const mockGetPhase = getHackASprint2026Phase as jest.MockedFunction<typeof getHackASprint2026Phase>;
const mockGetParticipantDocs = getAllHackASprint2026ParticipantScoreDocs as jest.MockedFunction<
  typeof getAllHackASprint2026ParticipantScoreDocs
>;
const mockResolveVoterGithub = resolveVoterGithubByUid as jest.MockedFunction<
  typeof resolveVoterGithubByUid
>;

const adminUser = {
  uid: "admin1",
  email: "admin@example.com",
  name: "Admin",
  isAdmin: true,
};

const sampleSubmission = {
  submissionId: "Alpha-Project",
  githubLogin: "alpha-dev",
  payload: {
    title: "Alpha",
    description: "First project",
    projectRepoUrl: "https://github.com/a/repo",
    deployedUrl: "https://alpha.example.com",
    loomVideoUrl: "https://loom.example.com/alpha",
  },
};

function buildDashboardDb(scoreData?: Record<string, unknown>) {
  const countGet = jest
    .fn()
    .mockResolvedValueOnce({ data: () => ({ count: 3 }) })
    .mockResolvedValueOnce({ data: () => ({ count: 12 }) });

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "hackathonShowcaseScores") {
        return {
          doc: jest.fn((id: string) => ({ id })),
        };
      }
      if (
        name === "hackathonASprint2026ParticipantScores" ||
        name === "hackathonEventSignups"
      ) {
        return {
          where: jest.fn(() => ({
            count: jest.fn(() => ({ get: countGet })),
          })),
        };
      }
      throw new Error(`unexpected collection ${name}`);
    }),
    getAll: jest.fn(async (...refs: Array<{ id: string }>) =>
      refs.map((ref) => ({
        exists: Boolean(scoreData),
        data: () => scoreData ?? {},
        id: ref.id,
      })),
    ),
  };

  return db;
}

describe("GET /api/hackathons/showcase/hack-a-sprint-2026/admin-dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockCheckRateLimit.mockReturnValue({ success: true, retryAfter: 0 });
    mockGetPhase.mockReturnValue("judging");
    mockFetchSubmissions.mockResolvedValue([]);
    mockGetJudgeUidSet.mockReturnValue(new Set(["judge-1"]));
    mockGetParticipantDocs.mockResolvedValue([]);
    mockResolveVoterGithub.mockResolvedValue(new Map());
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 45 });

    const { status, body } = await readJson(
      await GET(
        makeRequest({
          path: "/api/hackathons/showcase/hack-a-sprint-2026/admin-dashboard",
        }),
      ),
    );

    expect(status).toBe(429);
    expect(body).toMatchObject({ error: "Too many requests", retryAfterSeconds: 45 });
    expect(getClientIdentifier).toHaveBeenCalled();
  });

  it("returns 403 when the caller is not an admin", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "member@example.com",
      name: "Member",
      isAdmin: false,
    });

    const res = await GET(
      makeAuthedRequest({
        path: "/api/hackathons/showcase/hack-a-sprint-2026/admin-dashboard",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 500 when Firestore admin is unavailable", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockGetAdminDb.mockReturnValue(null);

    const res = await GET(
      makeAuthedRequest({
        path: "/api/hackathons/showcase/hack-a-sprint-2026/admin-dashboard",
      }),
    );
    expect(res.status).toBe(500);
  });

  it("returns dashboard payload with scored submissions sorted by raw score", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockFetchSubmissions.mockResolvedValue([
      sampleSubmission,
      {
        ...sampleSubmission,
        submissionId: "Beta-Project",
        githubLogin: "beta-dev",
        payload: { ...sampleSubmission.payload, title: "Beta" },
      },
    ] as never);
    mockGetJudgeUidSet.mockReturnValue(new Set(["judge-1", "judge-2"]));
    mockGetParticipantDocs.mockResolvedValue([
      { userId: "voter-1", scores: { "alpha-project": 9 }, githubLogin: "voter" },
    ] as never);
    mockResolveVoterGithub.mockResolvedValue(new Map([["voter-1", "voter"]]));

    const scoreBySubmission: Record<string, Record<string, unknown>> = {
      "hack-a-sprint-2026__alpha-project": {
        aiScore: 8,
        aiReasoning: " Strong demo ",
        judgeScores: { "judge-1": 9, "judge-2": 7, bad: 99 },
        peerVoteCount: 4,
      },
      "hack-a-sprint-2026__beta-project": {
        aiScore: 6,
        judgeScores: { "judge-1": 5 },
        peerVoteCount: 1,
      },
    };

    const db = buildDashboardDb();
    db.getAll.mockImplementation(async (...refs: Array<{ id: string }>) =>
      refs.map((ref) => ({
        exists: ref.id in scoreBySubmission,
        data: () => scoreBySubmission[ref.id] ?? {},
      })),
    );
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson<{ submissions: Array<{ submissionId: string; rawScore: number | null }> }>(
      await GET(
        makeAuthedRequest({
          path: "/api/hackathons/showcase/hack-a-sprint-2026/admin-dashboard",
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      phase: "judging",
      totalSubmissions: 2,
      totalSignups: 12,
      totalVoters: 3,
      judgeUids: ["judge-1", "judge-2"],
      judgeProgress: [
        { uid: "judge-1", scored: 2, total: 2 },
        { uid: "judge-2", scored: 1, total: 2 },
      ],
    });
    expect(body.submissions[0]?.submissionId).toBe("Alpha-Project");
    expect(body.submissions[0]).toMatchObject({
      aiScore: 8,
      aiReasoning: "Strong demo",
      judgeAverage: 8,
      peerVoteCount: 4,
      rawScore: 8,
    });
    expect(body.submissions[1]).toMatchObject({
      submissionId: "Beta-Project",
      rawScore: 6,
    });
    expect(db.collection).toHaveBeenCalledWith("hackathonEventSignups");
    expect(mockGetParticipantDocs).toHaveBeenCalled();
  });

  it("returns 500 when loading the dashboard throws", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockFetchSubmissions.mockRejectedValue(new Error("github down"));

    const res = await GET(
      makeAuthedRequest({
        path: "/api/hackathons/showcase/hack-a-sprint-2026/admin-dashboard",
      }),
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to load dashboard");
  });
});
