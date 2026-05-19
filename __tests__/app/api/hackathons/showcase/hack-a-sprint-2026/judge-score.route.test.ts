/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #28 — Hack-a-Sprint 2026 judge-score POST.
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/hackathons/showcase/hack-a-sprint-2026/judge-score/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { fetchShowcaseSubmissionsFromGitHub } from "@/lib/hackathon-showcase";
import { userIsHackASprint2026Judge } from "@/lib/hackathon-showcase-admin";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/hackathon-showcase", () => ({
  ...jest.requireActual("@/lib/hackathon-showcase"),
  fetchShowcaseSubmissionsFromGitHub: jest.fn(),
}));
jest.mock("@/lib/hackathon-showcase-admin", () => ({
  userIsHackASprint2026Judge: jest.fn(),
}));
jest.mock("@/lib/hackathon-asprint-2026-schedule", () => ({
  ...jest.requireActual("@/lib/hackathon-asprint-2026-schedule"),
  getHackASprint2026Phase: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  ...jest.requireActual("@/lib/rate-limit"),
  getClientIdentifier: jest.fn(() => "client-1"),
}));
jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "TS") },
}));

const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockSubs = fetchShowcaseSubmissionsFromGitHub as jest.MockedFunction<
  typeof fetchShowcaseSubmissionsFromGitHub
>;
const mockIsJudge = userIsHackASprint2026Judge as jest.MockedFunction<
  typeof userIsHackASprint2026Judge
>;
const mockPhase = getHackASprint2026Phase as jest.MockedFunction<typeof getHackASprint2026Phase>;
const mockRate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

function makeReq(body: unknown) {
  return new NextRequest(
    "https://example.com/api/hackathons/showcase/hack-a-sprint-2026/judge-score",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

function setupDb() {
  const set = jest.fn().mockResolvedValue(undefined);
  const doc = jest.fn(() => ({ set }));
  const collection = jest.fn(() => ({ doc }));
  mockDb.mockReturnValue({ collection } as never);
  return { set, doc, collection };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockResolvedValue({ success: true, remaining: 9 } as never);
  mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
  mockPhase.mockReturnValue("peerVotingOpen");
  mockIsJudge.mockResolvedValue(true);
  mockSubs.mockResolvedValue([
    { submissionId: "team-alpha", repoUrl: "https://github.com/x/a" } as never,
    { submissionId: "team-beta", repoUrl: "https://github.com/x/b" } as never,
  ]);
});

describe("POST /api/hackathons/showcase/hack-a-sprint-2026/judge-score", () => {
  it("returns 429 when rate limit denied", async () => {
    mockRate.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      retryAfter: 30,
    } as never);
    const res = await POST(makeReq({ submissionId: "team-alpha", score: 8 }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(body.retryAfterSeconds).toBe(30);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ submissionId: "team-alpha", score: 8 }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when phase is not peerVotingOpen", async () => {
    mockPhase.mockReturnValueOnce("submissionsOpen" as never);
    const res = await POST(makeReq({ submissionId: "team-alpha", score: 8 }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("judging window");
  });

  it("returns 500 when admin db is null", async () => {
    mockDb.mockReturnValue(null as never);
    const res = await POST(makeReq({ submissionId: "team-alpha", score: 8 }));
    expect(res.status).toBe(500);
  });

  it("returns 403 when user is not a judge", async () => {
    mockIsJudge.mockResolvedValueOnce(false);
    setupDb();
    const res = await POST(makeReq({ submissionId: "team-alpha", score: 8 }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Not a judge");
  });

  it("returns 400 when body is not valid JSON", async () => {
    setupDb();
    const res = await POST(makeReq("not-json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when schema validation fails (missing submissionId)", async () => {
    setupDb();
    const res = await POST(makeReq({ score: 8 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when score is out of range (>10)", async () => {
    setupDb();
    const res = await POST(makeReq({ submissionId: "team-alpha", score: 11 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when score is non-integer", async () => {
    setupDb();
    const res = await POST(makeReq({ submissionId: "team-alpha", score: 5.5 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("integer score 1-10");
  });

  it("returns 400 when submissionId is unknown to GitHub", async () => {
    setupDb();
    const res = await POST(makeReq({ submissionId: "team-ghost", score: 7 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unknown submission");
  });

  it("normalises submissionId to lowercase + trimmed before lookup", async () => {
    const { set, doc } = setupDb();
    const res = await POST(makeReq({ submissionId: "  TEAM-ALPHA  ", score: 8 }));
    expect(res.status).toBe(200);
    expect(doc).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: "team-alpha",
        judgeScores: { u1: 8 },
      }),
      { merge: true },
    );
  });

  it("writes the score doc on happy path", async () => {
    const { set } = setupDb();
    const res = await POST(makeReq({ submissionId: "team-alpha", score: 9 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: "team-alpha",
        judgeScores: { u1: 9 },
        updatedAt: "TS",
      }),
      { merge: true },
    );
  });

  it("returns 500 when the firestore set call throws", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const set = jest.fn().mockRejectedValue(new Error("write conflict"));
    mockDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => ({ set })) })),
    } as never);
    const res = await POST(makeReq({ submissionId: "team-alpha", score: 8 }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Failed to save");
    consoleErrorSpy.mockRestore();
  });
});
