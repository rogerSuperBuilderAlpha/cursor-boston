/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/hackathons/team/profile/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return {
    ...actual,
    getClientIdentifier: jest.fn(() => "test-ip"),
    checkRateLimit: jest.fn(() => ({ success: true, retryAfter: 0 })),
  };
});

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/hackathons/team/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/hackathons/team/profile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ success: true, retryAfter: 0 });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 30 });
    const res = await PATCH(makeRequest({ teamId: "t1", name: "New" }));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/too many/i);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ teamId: "t1", name: "New" }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockGetAdminDb.mockReturnValue(null as never);
    const res = await PATCH(makeRequest({ teamId: "t1", name: "New" }));
    expect(res.status).toBe(500);
  });

  it("returns 400 when body is not valid JSON", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockGetAdminDb.mockReturnValue({} as never);
    const req = new NextRequest("http://localhost/api/hackathons/team/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid json/i);
  });

  it("returns 400 when teamId is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockGetAdminDb.mockReturnValue({ collection: jest.fn() } as never);
    const res = await PATCH(makeRequest({ name: "New" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid teamId/i);
  });

  it("returns 404 when team does not exist", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({ exists: false })),
        })),
      })),
    } as never);
    const res = await PATCH(makeRequest({ teamId: "team123", name: "New" }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not a team member", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({
            exists: true,
            data: () => ({ memberIds: ["u2", "u3"], wins: 2 }),
          })),
        })),
      })),
    } as never);
    const res = await PATCH(makeRequest({ teamId: "team123", name: "New" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/not a member/i);
  });

  it("returns 403 when team has zero wins", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({
            exists: true,
            data: () => ({ memberIds: ["u1"], wins: 0 }),
          })),
        })),
      })),
    } as never);
    const res = await PATCH(makeRequest({ teamId: "team123", name: "New" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/wins/i);
  });

  it("returns 400 when name exceeds 50 characters", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({
            exists: true,
            data: () => ({ memberIds: ["u1"], wins: 1 }),
          })),
        })),
      })),
    } as never);
    const longName = "A".repeat(51);
    const res = await PATCH(makeRequest({ teamId: "team123", name: longName }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/50 characters/i);
  });

  it("returns 400 when neither name nor logoUrl provided", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({
            exists: true,
            data: () => ({ memberIds: ["u1"], wins: 1 }),
          })),
        })),
      })),
    } as never);
    const res = await PATCH(makeRequest({ teamId: "team123" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/provide name/i);
  });

  it("returns 200 and updates team name successfully", async () => {
    const updateMock = jest.fn().mockResolvedValue(undefined);
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({
            exists: true,
            data: () => ({ memberIds: ["u1"], wins: 1 }),
          })),
          update: updateMock,
        })),
      })),
    } as never);
    const res = await PATCH(makeRequest({ teamId: "team123", name: "Cool Team" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Cool Team" })
    );
  });

  it("returns 200 and updates logoUrl successfully", async () => {
    const updateMock = jest.fn().mockResolvedValue(undefined);
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({
            exists: true,
            data: () => ({ memberIds: ["u1"], wins: 3 }),
          })),
          update: updateMock,
        })),
      })),
    } as never);
    const res = await PATCH(makeRequest({ teamId: "team123", logoUrl: "https://example.com/logo.png" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ logoUrl: "https://example.com/logo.png" })
    );
  });

  it("returns 400 for invalid logoUrl format", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({
            exists: true,
            data: () => ({ memberIds: ["u1"], wins: 1 }),
          })),
        })),
      })),
    } as never);
    const res = await PATCH(makeRequest({ teamId: "team123", logoUrl: "javascript:alert(1)" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid logoUrl/i);
  });
});
