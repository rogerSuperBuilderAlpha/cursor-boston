/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST, DELETE } from "@/app/api/tips/subscribe/route";

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

const mockAddSubscriber = jest.fn();
const mockRemoveSubscriber = jest.fn();
jest.mock("@/lib/tip-subscribers", () => ({
  addSubscriber: (...args: unknown[]) => mockAddSubscriber(...args),
  removeSubscriber: (...args: unknown[]) => mockRemoveSubscriber(...args),
}));

jest.mock("@/lib/unsubscribe-token", () => ({
  verifyUnsubscribeToken: jest.fn((email: string, token: string) => token === "valid-token"),
}));

describe("POST /api/tips/subscribe", () => {
  beforeEach(() => jest.clearAllMocks());

  it("subscribes with a valid email", async () => {
    mockAddSubscriber.mockResolvedValue(undefined);
    const req = new NextRequest("http://localhost/api/tips/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockAddSubscriber).toHaveBeenCalledWith("alice@example.com", undefined);
  });

  it("returns 400 for invalid email", async () => {
    const req = new NextRequest("http://localhost/api/tips/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing email", async () => {
    const req = new NextRequest("http://localhost/api/tips/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/tips/subscribe", () => {
  beforeEach(() => jest.clearAllMocks());

  it("unsubscribes with valid token", async () => {
    mockRemoveSubscriber.mockResolvedValue(undefined);
    const req = new NextRequest(
      "http://localhost/api/tips/subscribe?email=alice@example.com&token=valid-token",
      { method: "DELETE" }
    );

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(mockRemoveSubscriber).toHaveBeenCalledWith("alice@example.com");
  });

  it("returns 403 for invalid token", async () => {
    const req = new NextRequest(
      "http://localhost/api/tips/subscribe?email=alice@example.com&token=bad-token",
      { method: "DELETE" }
    );

    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when email or token is missing", async () => {
    const req = new NextRequest("http://localhost/api/tips/subscribe?email=alice@example.com", {
      method: "DELETE",
    });

    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
