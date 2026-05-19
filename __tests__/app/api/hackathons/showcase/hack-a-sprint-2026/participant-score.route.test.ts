/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #29 — Hack-a-Sprint 2026 participant-score POST.
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/hackathons/showcase/hack-a-sprint-2026/participant-score/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { fetchShowcaseSubmissionsFromGitHub } from "@/lib/hackathon-showcase";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/hackathon-showcase", () => ({
  ...jest.requireActual("@/lib/hackathon-showcase"),
  fetchShowcaseSubmissionsFromGitHub: jest.fn(),
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
const mockPhase = getHackASprint2026Phase as jest.MockedFunction<typeof getHackASprint2026Phase>;
const mockRate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

function makeReq(body: unknown) {
  return new NextRequest(
    "https://example.com/api/hackathons/showcase/hack-a-sprint-2026/participant-score",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

interface DbOpts {
  userDoc?: { exists: boolean; data?: Record<string, unknown> };
  signupDoc?: { exists: boolean; data?: Record<string, unknown> };
  scoresDoc?: { exists: boolean; data?: Record<string, unknown> };
  scoresSetThrows?: boolean;
}

function setupDb(opts: DbOpts = {}) {
  const userGet = jest.fn().mockResolvedValue({
    exists: opts.userDoc?.exists ?? true,
    data: () => opts.userDoc?.data ?? { github: { login: "judge-alpha" } },
  });
  const signupGet = jest.fn().mockResolvedValue({
    exists: opts.signupDoc?.exists ?? true,
    data: () => opts.signupDoc?.data ?? { checkedInAt: new Date() },
  });
  const scoresGet = jest.fn().mockResolvedValue({
    exists: opts.scoresDoc?.exists ?? false,
    data: () => opts.scoresDoc?.data ?? undefined,
  });
  const scoresSet = jest.fn();
  if (opts.scoresSetThrows) {
    scoresSet.mockRejectedValue(new Error("write conflict"));
  } else {
    scoresSet.mockResolvedValue(undefined);
  }
  const collection = jest.fn((name: string) => {
    if (name === "users") return { doc: jest.fn(() => ({ get: userGet })) };
    if (name === "hackathonEventSignups") return { doc: jest.fn(() => ({ get: signupGet })) };
    return {
      // participant scores
      doc: jest.fn(() => ({ get: scoresGet, set: scoresSet })),
    };
  });
  mockDb.mockReturnValue({ collection } as never);
  return { userGet, signupGet, scoresGet, scoresSet };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockResolvedValue({ success: true, remaining: 9 } as never);
  mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
  mockPhase.mockReturnValue("checkin");
  mockSubs.mockResolvedValue([
    { submissionId: "team-alpha", githubLogin: "judge-alpha" } as never,
    { submissionId: "team-beta", githubLogin: "judge-beta" } as never,
  ]);
});

describe("POST /api/hackathons/showcase/hack-a-sprint-2026/participant-score", () => {
  it("returns 429 when client rate limit denied", async () => {
    mockRate.mockResolvedValueOnce({ success: false, retryAfter: 60 } as never);
    const res = await POST(makeReq({ submissionId: "team-beta", score: 9 }));
    expect(res.status).toBe(429);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ submissionId: "team-beta", score: 9 }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when admin db is null", async () => {
    mockDb.mockReturnValue(null as never);
    const res = await POST(makeReq({ submissionId: "team-beta", score: 9 }));
    expect(res.status).toBe(500);
  });

  it("returns 400 when body is not JSON", async () => {
    setupDb();
    const res = await POST(makeReq("not-json"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid JSON");
  });

  it("returns 400 when schema validation fails", async () => {
    setupDb();
    const res = await POST(makeReq({ score: 5 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when score is not an integer 1-10", async () => {
    setupDb();
    const res = await POST(makeReq({ submissionId: "team-beta", score: 7.5 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("integer score 1-10");
  });

  it("returns 400 when submission is unknown", async () => {
    setupDb();
    const res = await POST(makeReq({ submissionId: "ghost", score: 5 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unknown submission");
  });

  it("returns 403 when user has no github.login on profile", async () => {
    setupDb({ userDoc: { exists: true, data: { github: {} } } });
    const res = await POST(makeReq({ submissionId: "team-beta", score: 6 }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Connect GitHub");
  });

  it("returns 403 when user is not a merged-submission submitter", async () => {
    setupDb({ userDoc: { exists: true, data: { github: { login: "outsider" } } } });
    const res = await POST(makeReq({ submissionId: "team-beta", score: 6 }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("merged showcase submission");
  });

  it("returns 400 when user tries to score their own submission", async () => {
    setupDb({ userDoc: { exists: true, data: { github: { login: "judge-alpha" } } } });
    const res = await POST(makeReq({ submissionId: "team-alpha", score: 9 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("cannot score your own");
  });

  it("returns 403 when not checked in (signup doc missing during checkin phase)", async () => {
    setupDb({ signupDoc: { exists: false } });
    const res = await POST(makeReq({ submissionId: "team-beta", score: 7 }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("checked in");
  });

  it("returns 403 when signup exists but checkedInAt is null", async () => {
    setupDb({
      signupDoc: { exists: true, data: { checkedInAt: null } },
    });
    const res = await POST(makeReq({ submissionId: "team-beta", score: 7 }));
    expect(res.status).toBe(403);
  });

  it("skips checkin requirement during peerVotingOpen phase", async () => {
    mockPhase.mockReturnValue("peerVotingOpen");
    const { scoresSet } = setupDb({ signupDoc: { exists: false } });
    const res = await POST(makeReq({ submissionId: "team-beta", score: 8 }));
    expect(res.status).toBe(200);
    expect(scoresSet).toHaveBeenCalled();
  });

  it("skips checkin requirement during resultsOpen phase", async () => {
    mockPhase.mockReturnValue("resultsOpen");
    setupDb({ signupDoc: { exists: false } });
    const res = await POST(makeReq({ submissionId: "team-beta", score: 8 }));
    expect(res.status).toBe(200);
  });

  it("returns 429 when per-uid rate limit denies", async () => {
    setupDb();
    mockRate
      .mockResolvedValueOnce({ success: true } as never)
      .mockResolvedValueOnce({ success: false, retryAfter: 5 } as never);
    const res = await POST(makeReq({ submissionId: "team-beta", score: 5 }));
    expect(res.status).toBe(429);
  });

  it("writes a new scores doc with the submitter's previous scores merged", async () => {
    const { scoresSet } = setupDb({
      scoresDoc: { exists: true, data: { scores: { "team-other": 3 } } },
    });
    const res = await POST(makeReq({ submissionId: "team-beta", score: 9 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, submissionId: "team-beta", score: 9 });
    expect(scoresSet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        githubLogin: "judge-alpha",
        scores: { "team-other": 3, "team-beta": 9 },
        updatedAt: "TS",
      }),
      { merge: true },
    );
  });

  it("creates a fresh scores doc on first submission (snap.exists=false)", async () => {
    const { scoresSet } = setupDb({ scoresDoc: { exists: false } });
    const res = await POST(makeReq({ submissionId: "team-beta", score: 9 }));
    expect(res.status).toBe(200);
    expect(scoresSet).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: { "team-beta": 9 },
      }),
      { merge: true },
    );
  });

  it("returns 500 with 'Save failed' when the firestore set throws", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    setupDb({ scoresSetThrows: true });
    const res = await POST(makeReq({ submissionId: "team-beta", score: 9 }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Save failed");
    consoleErrorSpy.mockRestore();
  });
});
