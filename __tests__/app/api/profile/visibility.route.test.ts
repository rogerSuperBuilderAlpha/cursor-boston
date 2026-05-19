/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #68 — profile/visibility PATCH + GET route.
 */
import { NextRequest } from "next/server";
import { PATCH, GET } from "@/app/api/profile/visibility/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
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
const mockRate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

function makeReq(opts: { method?: "PATCH" | "GET"; body?: unknown } = {}) {
  return new NextRequest("https://example.com/api/profile/visibility", {
    method: opts.method ?? "PATCH",
    headers: { "content-type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function setupUserDb(opts: {
  exists?: boolean;
  data?: Record<string, unknown>;
  updateThrows?: boolean;
}) {
  const update = jest.fn();
  if (opts.updateThrows) update.mockRejectedValue(new Error("update failed"));
  else update.mockResolvedValue(undefined);
  const userSnap = {
    exists: opts.exists ?? true,
    data: () => opts.data ?? { visibility: { isPublic: true } },
  };
  const getSpy = jest.fn().mockResolvedValue(userSnap);
  mockDb.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({ get: getSpy, update })),
    })),
  } as never);
  return { update, getSpy };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 } as never);
  mockUser.mockResolvedValue({ uid: "u1" } as never);
});

describe("PATCH /api/profile/visibility", () => {
  it("returns 429 with Retry-After when rate-limited", async () => {
    mockRate.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      retryAfter: 30,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await PATCH(makeReq({ method: "PATCH", body: { isPublic: true } }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("defaults Retry-After=60 when retryAfter absent", async () => {
    mockRate.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await PATCH(makeReq({ method: "PATCH", body: { isPublic: true } }));
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await PATCH(makeReq({ method: "PATCH", body: { isPublic: true } }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when admin db is null", async () => {
    mockDb.mockReturnValue(null as never);
    const res = await PATCH(makeReq({ method: "PATCH", body: { isPublic: true } }));
    expect(res.status).toBe(500);
  });

  it("returns 400 when body is not valid JSON", async () => {
    setupUserDb({});
    const req = new NextRequest("https://example.com/api/profile/visibility", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when zod schema rejects body shape", async () => {
    setupUserDb({});
    const res = await PATCH(makeReq({ method: "PATCH", body: { isPublic: "not-a-bool" } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when no valid boolean fields are present", async () => {
    setupUserDb({});
    // Empty object — all fields optional, no booleans
    const res = await PATCH(makeReq({ method: "PATCH", body: {} }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No valid fields");
  });

  it("updates visibility on happy path", async () => {
    const { update } = setupUserDb({
      exists: true,
      data: { visibility: { isPublic: true, showDiscord: true } },
    });
    const res = await PATCH(
      makeReq({ method: "PATCH", body: { isPublic: true, showDiscord: true } }),
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        "visibility.isPublic": true,
        "visibility.showDiscord": true,
        updatedAt: "TS",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.visibility).toEqual({ isPublic: true, showDiscord: true });
  });

  it("returns 500 'Failed to update visibility' when update throws", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    setupUserDb({ updateThrows: true });
    const res = await PATCH(makeReq({ method: "PATCH", body: { isPublic: true } }));
    expect(res.status).toBe(500);
    consoleErrorSpy.mockRestore();
  });
});

describe("GET /api/profile/visibility", () => {
  it("returns 429 when rate-limited", async () => {
    mockRate.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      retryAfter: 30,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await GET(makeReq({ method: "GET" }));
    expect(res.status).toBe(429);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await GET(makeReq({ method: "GET" }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when admin db is null", async () => {
    mockDb.mockReturnValue(null as never);
    const res = await GET(makeReq({ method: "GET" }));
    expect(res.status).toBe(500);
  });

  it("returns default profile shape when user doc does not exist", async () => {
    setupUserDb({ exists: false });
    const res = await GET(makeReq({ method: "GET" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile).toEqual({
      hasDisplayName: false,
      hasGithub: false,
      hasDiscord: false,
      visibility: {},
    });
  });

  it("returns the full profile shape on happy path", async () => {
    setupUserDb({
      exists: true,
      data: {
        displayName: "Alice",
        github: { login: "alice" },
        discord: { username: "alice#0001" },
        visibility: { isPublic: true },
        photoURL: "https://x/a.png",
      },
    });
    const res = await GET(makeReq({ method: "GET" }));
    const body = await res.json();
    expect(body.profile).toMatchObject({
      displayName: "Alice",
      hasDisplayName: true,
      hasGithub: true,
      githubUsername: "alice",
      hasDiscord: true,
      discordUsername: "alice#0001",
      visibility: { isPublic: true },
      photoURL: "https://x/a.png",
    });
  });

  it("returns 500 'Failed to get profile' when get throws", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockRejectedValue(new Error("firestore down")),
        })),
      })),
    } as never);
    const res = await GET(makeReq({ method: "GET" }));
    expect(res.status).toBe(500);
    consoleErrorSpy.mockRestore();
  });
});
