/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #61 — Hack-a-Sprint 2026 ai-score POST.
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/hackathons/showcase/hack-a-sprint-2026/ai-score/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { fetchShowcaseSubmissionsFromGitHub } from "@/lib/hackathon-showcase";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/hackathon-showcase", () => ({
  ...jest.requireActual("@/lib/hackathon-showcase"),
  fetchShowcaseSubmissionsFromGitHub: jest.fn(),
}));
jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  ...jest.requireActual("@/lib/rate-limit"),
  getClientIdentifier: jest.fn(() => "client-1"),
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "TS") },
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockSubs = fetchShowcaseSubmissionsFromGitHub as jest.MockedFunction<
  typeof fetchShowcaseSubmissionsFromGitHub
>;
const mockRate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

const VALID_BODY = { submissionId: "team-alpha", aiScore: 8 };

function makeReq(body: unknown = VALID_BODY) {
  return new NextRequest(
    "https://example.com/api/hackathons/showcase/hack-a-sprint-2026/ai-score",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

function setupDb() {
  const set = jest.fn().mockResolvedValue(undefined);
  mockDb.mockReturnValue({
    collection: jest.fn(() => ({ doc: jest.fn(() => ({ set })) })),
  } as never);
  return { set };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockResolvedValue({ success: true } as never);
  mockUser.mockResolvedValue({ uid: "admin", isAdmin: true } as never);
  mockSubs.mockResolvedValue([
    { submissionId: "team-alpha" } as never,
    { submissionId: "team-beta" } as never,
  ]);
});

describe("POST /api/hackathons/showcase/hack-a-sprint-2026/ai-score", () => {
  it("returns 429 when rate-limited, with retryAfterSeconds", async () => {
    mockRate.mockResolvedValueOnce({
      success: false,
      retryAfter: 30,
    } as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(body.retryAfterSeconds).toBe(30);
  });

  it("returns 403 when caller is not admin", async () => {
    mockUser.mockResolvedValue({ uid: "user", isAdmin: false } as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 403 when caller is not authenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await POST(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await POST(makeReq("not-json"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid JSON");
  });

  it("returns 400 for schema rejection", async () => {
    const res = await POST(makeReq({ aiScore: 8 /* no submissionId */ }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for out-of-range aiScore (>10)", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, aiScore: 11 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-integer aiScore", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, aiScore: 5.5 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("integer aiScore 1-10");
  });

  it("returns 400 for unknown submissionId", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, submissionId: "ghost" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unknown submission");
  });

  it("returns 500 when admin db is null", async () => {
    mockDb.mockReturnValue(null as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });

  it("writes the aiScore doc on happy path without aiReasoning", async () => {
    const { set } = setupDb();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: "team-alpha",
        aiScore: 8,
        updatedAt: "TS",
      }),
      { merge: true },
    );
    // aiReasoning should not be present when not provided
    const payload = set.mock.calls[0][0];
    expect(payload.aiReasoning).toBeUndefined();
  });

  it("includes aiReasoning when provided (trimmed)", async () => {
    const { set } = setupDb();
    await POST(makeReq({ ...VALID_BODY, aiReasoning: "  Great work on the demo  " }));
    const payload = set.mock.calls[0][0];
    expect(payload.aiReasoning).toBe("Great work on the demo");
  });

  it("clamps aiReasoning to 7998 chars (7997 slice + ellipsis)", async () => {
    const { set } = setupDb();
    const longText = "A".repeat(9000);
    await POST(makeReq({ ...VALID_BODY, aiReasoning: longText }));
    const payload = set.mock.calls[0][0];
    expect((payload.aiReasoning as string).length).toBe(7998);
    expect((payload.aiReasoning as string).endsWith("…")).toBe(true);
  });

  it("omits aiReasoning when whitespace-only", async () => {
    const { set } = setupDb();
    await POST(makeReq({ ...VALID_BODY, aiReasoning: "   " }));
    const payload = set.mock.calls[0][0];
    expect(payload.aiReasoning).toBeUndefined();
  });

  it("normalises submissionId to lowercase + trimmed", async () => {
    setupDb();
    const res = await POST(
      makeReq({ submissionId: "  TEAM-ALPHA  ", aiScore: 7 }),
    );
    expect(res.status).toBe(200);
  });

  it("returns 500 'Failed to save AI score' when firestore set throws", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const set = jest.fn().mockRejectedValue(new Error("write failed"));
    mockDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => ({ set })) })),
    } as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to save AI score");
    consoleErrorSpy.mockRestore();
  });
});
