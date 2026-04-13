/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/tips/submit/route";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return {
    ...actual,
    getClientIdentifier: jest.fn(() => "test-client"),
    checkRateLimit: jest.fn(() => ({ success: true, retryAfter: 0 })),
  };
});

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/sanitize", () => ({
  sanitizeText: jest.fn((s: string) => s),
}));

const mockCreateTip = jest.fn();
jest.mock("@/lib/tips", () => ({
  createTip: (...args: unknown[]) => mockCreateTip(...args),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/tips/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/tips/submit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ title: "Test", content: "Content" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when title is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Alice" });
    const res = await POST(makeRequest({ content: "Content" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Alice" });
    const res = await POST(makeRequest({ title: "Title" }));
    expect(res.status).toBe(400);
  });

  it("creates a tip with pending status for regular users", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Alice" });
    mockCreateTip.mockResolvedValue("tip-123");

    const res = await POST(
      makeRequest({ title: "My Tip", content: "Use Cmd+K", category: "Keyboard Shortcuts" })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe("tip-123");
    expect(data.status).toBe("pending");
    expect(mockCreateTip).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "My Tip",
        content: "Use Cmd+K",
        category: "Keyboard Shortcuts",
        status: "pending",
        authorId: "u1",
        authorName: "Alice",
      })
    );
  });

  it("creates a tip with published status for admins", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Admin", isAdmin: true });
    mockCreateTip.mockResolvedValue("tip-456");

    const res = await POST(makeRequest({ title: "Admin Tip", content: "Admin content" }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.status).toBe("published");
  });

  it("defaults to General category when invalid category is provided", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Alice" });
    mockCreateTip.mockResolvedValue("tip-789");

    await POST(makeRequest({ title: "Tip", content: "Content", category: "invalid" }));

    expect(mockCreateTip).toHaveBeenCalledWith(
      expect.objectContaining({ category: "General" })
    );
  });
});
