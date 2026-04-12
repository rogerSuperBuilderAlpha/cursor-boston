/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/notifications/unsubscribe/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/unsubscribe-token", () => ({
  verifyUnsubscribeToken: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true })),
  getClientIdentifier: jest.fn(() => "test-ip"),
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockVerifyToken = verifyUnsubscribeToken as jest.MockedFunction<typeof verifyUnsubscribeToken>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

const VALID_TOKEN = "a".repeat(64);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/notifications/unsubscribe");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

describe("GET /api/notifications/unsubscribe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ success: true } as never);
  });

  it("redirects to rate-limited when rate limit exceeded", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false } as never);

    const res = await GET(makeRequest({ email: "test@example.com", token: VALID_TOKEN }));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).searchParams.get("status")).toBe("rate-limited");
  });

  it("redirects to invalid when email is missing", async () => {
    const res = await GET(makeRequest({ token: VALID_TOKEN }));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).searchParams.get("status")).toBe("invalid");
  });

  it("redirects to invalid when token is missing", async () => {
    const res = await GET(makeRequest({ email: "test@example.com" }));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).searchParams.get("status")).toBe("invalid");
  });

  it("redirects to invalid when token format is wrong", async () => {
    const res = await GET(makeRequest({ email: "test@example.com", token: "bad-token" }));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).searchParams.get("status")).toBe("invalid");
  });

  it("redirects to invalid when token verification fails", async () => {
    mockVerifyToken.mockReturnValue(false);

    const res = await GET(makeRequest({ email: "test@example.com", token: VALID_TOKEN }));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).searchParams.get("status")).toBe("invalid");
  });

  it("redirects to error when db is unavailable", async () => {
    mockVerifyToken.mockReturnValue(true);
    mockGetAdminDb.mockReturnValue(null as never);

    const res = await GET(makeRequest({ email: "test@example.com", token: VALID_TOKEN }));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).searchParams.get("status")).toBe("error");
  });

  it("redirects to success when contact does not exist (no info leak)", async () => {
    mockVerifyToken.mockReturnValue(true);

    const docRef = {
      get: jest.fn(async () => ({ exists: false })),
    };

    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => docRef),
      })),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET(makeRequest({ email: "test@example.com", token: VALID_TOKEN }));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).searchParams.get("status")).toBe("success");
  });

  it("unsubscribes existing contact and redirects to success", async () => {
    mockVerifyToken.mockReturnValue(true);

    const updateFn = jest.fn(async () => undefined);
    const docRef = {
      get: jest.fn(async () => ({ exists: true })),
      update: updateFn,
    };

    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => docRef),
      })),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET(makeRequest({ email: "test@example.com", token: VALID_TOKEN }));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).searchParams.get("status")).toBe("success");
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ unsubscribed: true })
    );
  });

  it("redirects to error on Firestore exception", async () => {
    mockVerifyToken.mockReturnValue(true);

    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => {
            throw new Error("Firestore down");
          }),
        })),
      })),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET(makeRequest({ email: "test@example.com", token: VALID_TOKEN }));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).searchParams.get("status")).toBe("error");
  });
});
