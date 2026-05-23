/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/challenges/[challengeId]/submissions/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "SERVER_TIME") },
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "client-1"),
  checkRateLimit: jest.fn(() => ({ success: true, retryAfter: 0 })),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

const OPEN_CHALLENGE = {
  status: "open",
  submissionOpenAt: "2000-01-01T00:00:00.000Z",
  submissionCloseAt: "2999-12-31T23:59:59.000Z",
};

let challengeExists = true;
let challengeData: Record<string, unknown> = OPEN_CHALLENGE;
let existingSubmission = false;

const mockSubmissionSet = jest.fn();
const mockSubmissionDoc = jest.fn(() => ({
  id: "submission-1",
  set: mockSubmissionSet,
}));

const submissionsQuery = {
  where: jest.fn(() => submissionsQuery),
  limit: jest.fn(() => submissionsQuery),
  get: jest.fn(async () => ({
    empty: !existingSubmission,
    docs: existingSubmission ? [{ id: "existing-submission" }] : [],
  })),
  doc: mockSubmissionDoc,
};

const challengeGet = jest.fn(async () => ({
  exists: challengeExists,
  data: () => challengeData,
}));
const challengesCollection = {
  doc: jest.fn(() => ({ get: challengeGet })),
};

const mockDb = {
  collection: jest.fn((name: string) => {
    if (name === "monthlyChallenges") return challengesCollection;
    if (name === "monthlyChallengeSubmissions") return submissionsQuery;
    throw new Error(`unexpected collection ${name}`);
  }),
};

function params(challengeId = "may-2026") {
  return { params: Promise.resolve({ challengeId }) };
}

function request(body: unknown, raw = false): NextRequest {
  return new NextRequest("http://localhost/api/challenges/may-2026/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? String(body) : JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Prompt debugger",
    summary: "A submission that helps members compare prompt behavior.",
    repositoryUrl: "https://github.com/example/prompt-debugger",
    demoUrl: "https://example.com/demo",
    writeup:
      "This writeup explains the architecture, tradeoffs, validation, and how the project helps prompt authors.",
    cursorWorkflow:
      "Cursor helped inspect the app structure, generate tests, and iterate on the submission flow.",
    ...overrides,
  };
}

describe("POST /api/challenges/[challengeId]/submissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    challengeExists = true;
    challengeData = OPEN_CHALLENGE;
    existingSubmission = false;
    mockSubmissionSet.mockResolvedValue(undefined);
    mockCheckRateLimit.mockReturnValue({ success: true, retryAfter: 0 });
    mockGetVerifiedUser.mockResolvedValue({
      uid: "user-1",
      name: "Challenge Author",
      email: "author@example.com",
    });
    mockGetAdminDb.mockReturnValue(mockDb as never);
  });

  it("returns 400 for an invalid challenge id", async () => {
    const res = await POST(request(validBody()), params("../bad"));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_challenge_id" });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 30 });

    const res = await POST(request(validBody()), params());

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(mockGetVerifiedUser).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);

    const res = await POST(request(validBody()), params());

    expect(res.status).toBe(401);
  });

  it("returns 500 when Firebase Admin is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);

    const res = await POST(request(validBody()), params());

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "not_configured" });
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const res = await POST(request("not-json", true), params());

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_body" });
  });

  it("returns 400 when the body fails schema validation", async () => {
    const res = await POST(request(validBody({ title: "No" })), params());

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_body" });
  });

  it("returns 400 when URL validation fails after schema parsing", async () => {
    const res = await POST(
      request(validBody({ repositoryUrl: "https://example.com/not-github" })),
      params()
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_submission");
    expect(body.errors).toContain("repositoryUrl must point to a GitHub repository.");
  });

  it("returns 404 when the challenge does not exist", async () => {
    challengeExists = false;

    const res = await POST(request(validBody()), params());

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "challenge_not_found" });
  });

  it("returns 409 when the challenge is not accepting submissions", async () => {
    challengeData = { ...OPEN_CHALLENGE, status: "judging" };

    const res = await POST(request(validBody()), params());

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "challenge_not_accepting_submissions",
    });
  });

  it("returns 409 when the user already has an active submission", async () => {
    existingSubmission = true;

    const res = await POST(request(validBody()), params());

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "active_submission_exists" });
  });

  it("stores a draft submission for the authenticated owner", async () => {
    const res = await POST(request(validBody()), params());

    expect(res.status).toBe(201);
    expect(challengesCollection.doc).toHaveBeenCalledWith("may-2026");
    expect(submissionsQuery.where).toHaveBeenCalledWith("challengeId", "==", "may-2026");
    expect(submissionsQuery.where).toHaveBeenCalledWith("ownerUid", "==", "user-1");
    expect(mockSubmissionSet).toHaveBeenCalledTimes(1);
    const stored = mockSubmissionSet.mock.calls[0][0];
    expect(stored).toMatchObject({
      id: "submission-1",
      challengeId: "may-2026",
      ownerUid: "user-1",
      title: "Prompt debugger",
      repositoryUrl: "https://github.com/example/prompt-debugger",
      status: "draft",
      createdAt: "SERVER_TIME",
      updatedAt: "SERVER_TIME",
    });
    expect(stored).not.toHaveProperty("email");
    expect(stored).not.toHaveProperty("ownerEmail");

    const body = await res.json();
    expect(body.submission.status).toBe("draft");
    expect(body.submission.createdAt).toEqual(expect.any(String));
  });

  it("stores submittedAt when submitNow is true", async () => {
    const res = await POST(request(validBody({ submitNow: true })), params());

    expect(res.status).toBe(201);
    expect(mockSubmissionSet.mock.calls[0][0]).toMatchObject({
      status: "submitted",
      submittedAt: "SERVER_TIME",
    });
    const body = await res.json();
    expect(body.submission.submittedAt).toEqual(expect.any(String));
  });

  it("returns 500 when the write fails", async () => {
    mockSubmissionSet.mockRejectedValue(new Error("write failed"));

    const res = await POST(request(validBody()), params());

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "internal_error" });
  });
});
