/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/hackathons/pool/join/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

const mockCheckRateLimit = jest.fn().mockReturnValue({ success: true });
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIdentifier: () => "test-client",
  rateLimitConfigs: { hackathonAction: { windowMs: 60000, maxRequests: 10 } },
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/hackathons", () => ({
  getCurrentVirtualHackathonId: () => "2026-04",
}));

const mockGet = jest.fn();
const mockSet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: (name: string) => ({
      doc: (id: string) => {
        mockDocTracker(name, id);
        return { get: () => mockGet(name, id), set: mockSet };
      },
    }),
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;

const testUser: VerifiedUser = { uid: "u1", name: "Test User" };

/** Tracks which collection/doc combos are accessed */
let docTracker: Array<{ collection: string; id: string }> = [];
function mockDocTracker(collection: string, id: string) {
  docTracker.push({ collection, id });
}

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/hackathons/pool/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : "invalid-json",
  });
}

describe("POST /api/hackathons/pool/join", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    docTracker = [];
    mockCheckRateLimit.mockReturnValue({ success: true });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 30 });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(body.retryAfterSeconds).toBe(30);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const req = new NextRequest("http://localhost/api/hackathons/pool/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON in request body");
  });

  it("returns 400 when user profile not found", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "users") return { exists: false };
      return { exists: false };
    });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Profile not found");
  });

  it("returns 400 when profile is not public", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "users")
        return {
          exists: true,
          data: () => ({
            visibility: { isPublic: false },
            github: "user",
            discord: "user#1234",
          }),
        };
      return { exists: false };
    });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Make your profile public");
  });

  it("returns 400 when GitHub not connected", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "users")
        return {
          exists: true,
          data: () => ({
            visibility: { isPublic: true, showDiscord: true },
            discord: "user#1234",
          }),
        };
      return { exists: false };
    });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Connect GitHub");
  });

  it("returns 400 when Discord not connected", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "users")
        return {
          exists: true,
          data: () => ({
            visibility: { isPublic: true, showDiscord: true },
            github: "user",
          }),
        };
      return { exists: false };
    });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Connect Discord");
  });

  it("returns 400 when showDiscord is not enabled", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "users")
        return {
          exists: true,
          data: () => ({
            visibility: { isPublic: true, showDiscord: false },
            github: "user",
            discord: "user#1234",
          }),
        };
      return { exists: false };
    });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Show Discord");
  });

  it("returns 400 when user left a team with a registered repo", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const validProfile = {
      visibility: { isPublic: true, showDiscord: true },
      github: "user",
      discord: "user#1234",
    };
    mockGet.mockImplementation((collection: string) => {
      if (collection === "users")
        return { exists: true, data: () => validProfile };
      if (collection === "hackathonLeftTeam") return { exists: true };
      return { exists: false };
    });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("left a team");
  });

  it("returns 200 when already in pool", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const validProfile = {
      visibility: { isPublic: true, showDiscord: true },
      github: "user",
      discord: "user#1234",
    };
    mockGet.mockImplementation((collection: string) => {
      if (collection === "users")
        return { exists: true, data: () => validProfile };
      if (collection === "hackathonLeftTeam") return { exists: false };
      if (collection === "hackathonPool") return { exists: true };
      return { exists: false };
    });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.joined).toBe(true);
  });

  it("creates pool entry and returns 200 on success", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const validProfile = {
      visibility: { isPublic: true, showDiscord: true },
      github: "user",
      discord: "user#1234",
    };
    mockGet.mockImplementation((collection: string) => {
      if (collection === "users")
        return { exists: true, data: () => validProfile };
      if (collection === "hackathonLeftTeam") return { exists: false };
      if (collection === "hackathonPool") return { exists: false };
      return { exists: false };
    });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.joined).toBe(true);
    expect(body.hackathonId).toBe("2026-04");
    expect(mockSet).toHaveBeenCalled();
  });

  it("uses provided hackathonId from body", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const validProfile = {
      visibility: { isPublic: true, showDiscord: true },
      github: "user",
      discord: "user#1234",
    };
    mockGet.mockImplementation((collection: string) => {
      if (collection === "users")
        return { exists: true, data: () => validProfile };
      if (collection === "hackathonLeftTeam") return { exists: false };
      if (collection === "hackathonPool") return { exists: false };
      return { exists: false };
    });
    const res = await POST(makeRequest({ hackathonId: "2026-03" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hackathonId).toBe("2026-03");
  });
});
