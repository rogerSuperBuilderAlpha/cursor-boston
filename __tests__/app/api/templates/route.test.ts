/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/templates/route";
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

const mockSet = jest.fn();
const mockDoc = jest.fn(() => ({
  id: "templateABC123",
  set: mockSet,
}));
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
}));
const mockDb = {
  collection: mockCollection,
};

function request(body: unknown, raw = false): NextRequest {
  return new NextRequest("http://localhost/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? String(body) : JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Next.js launch checklist",
    summary: "Generate a launch readiness checklist for a Cursor project.",
    category: "Launch",
    useCase: "Release readiness",
    prompt:
      "Review {{project_name}} and list launch blockers, owners, rollback steps, and verification commands.",
    placeholders: [
      {
        name: "project_name",
        label: "Project name",
        description: "The app or package being launched.",
        required: true,
        example: "Cursor Boston",
      },
    ],
    tags: ["nextjs", "launch"],
    ...overrides,
  };
}

describe("POST /api/templates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSet.mockResolvedValue(undefined);
    mockCheckRateLimit.mockReturnValue({ success: true, retryAfter: 0 });
    mockGetVerifiedUser.mockResolvedValue({
      uid: "user-1",
      name: "Template Author",
      email: "author@example.com",
    });
    mockGetAdminDb.mockReturnValue(mockDb as never);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 45 });

    const res = await POST(request(validBody()));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("45");
    expect(mockGetVerifiedUser).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is not signed in", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);

    const res = await POST(request(validBody()));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "unauthorized" });
  });

  it("returns 500 when Firebase Admin is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);

    const res = await POST(request(validBody()));

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "not_configured" });
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const res = await POST(request("not-json", true));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_body" });
  });

  it("returns 400 when the contract schema rejects the body", async () => {
    const res = await POST(request(validBody({ title: "No" })));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_body" });
  });

  it("returns 400 when placeholder metadata does not match prompt tokens", async () => {
    const res = await POST(
      request(
        validBody({
          prompt: "Review {{project_name}} and {{missing_name}} before launch.",
        })
      )
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_template");
    expect(body.errors).toContain("Placeholder metadata required for: missing_name.");
  });

  it("stores a private draft template without PII", async () => {
    const res = await POST(request(validBody()));

    expect(res.status).toBe(201);
    expect(mockCollection).toHaveBeenCalledWith("promptTemplates");
    expect(mockSet).toHaveBeenCalledTimes(1);
    const stored = mockSet.mock.calls[0][0];
    expect(stored).toMatchObject({
      id: "templateABC123",
      slug: "next-js-launch-checklist-template",
      ownerUid: "user-1",
      title: "Next.js launch checklist",
      moderationStatus: "draft",
      visibility: "private",
      voteScore: 0,
      variantCount: 0,
      forkCount: 0,
      createdAt: "SERVER_TIME",
      updatedAt: "SERVER_TIME",
    });
    expect(stored).not.toHaveProperty("email");
    expect(stored).not.toHaveProperty("ownerEmail");

    const body = await res.json();
    expect(body.template.createdAt).toEqual(expect.any(String));
    expect(body.template.updatedAt).toEqual(expect.any(String));
    expect(body.template.moderationStatus).toBe("draft");
  });

  it("stores pending_review when submitForReview is true", async () => {
    const res = await POST(request(validBody({ submitForReview: true })));

    expect(res.status).toBe(201);
    expect(mockSet.mock.calls[0][0]).toMatchObject({
      moderationStatus: "pending_review",
      visibility: "private",
    });
  });

  it("returns 500 when Firestore write fails", async () => {
    mockSet.mockRejectedValue(new Error("firestore unavailable"));

    const res = await POST(request(validBody()));

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "internal_error" });
  });
});
