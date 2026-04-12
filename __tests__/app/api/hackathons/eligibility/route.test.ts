/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/hackathons/eligibility/route";
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

jest.mock("@/lib/hackathons", () => ({
  getCurrentVirtualHackathonId: jest.fn(() => "2026-04"),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function makeRequest(query?: string) {
  const url = query
    ? `http://localhost/api/hackathons/eligibility?${query}`
    : "http://localhost/api/hackathons/eligibility";
  return new NextRequest(url, { method: "GET" });
}

function mockDbWithProfile(profileData: Record<string, unknown> | null, leftTeamExists = false) {
  mockGetAdminDb.mockReturnValue({
    collection: jest.fn((name: string) => {
      if (name === "users") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () =>
              profileData
                ? { exists: true, data: () => profileData }
                : { exists: false, data: () => undefined }
            ),
          })),
        };
      }
      if (name === "hackathonLeftTeam") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: leftTeamExists })),
          })),
        };
      }
      return { doc: jest.fn() };
    }),
  } as never);
}

const FULL_PROFILE = {
  github: "user123",
  discord: "user#1234",
  visibility: { isPublic: true, showDiscord: true },
};

describe("GET /api/hackathons/eligibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ success: true, retryAfter: 0 });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 30 });
    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/too many/i);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns eligible=false when db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockGetAdminDb.mockReturnValue(null as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.eligible).toBe(false);
    expect(data.reason).toMatch(/not configured/i);
  });

  it("returns eligible=false when profile not found", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockDbWithProfile(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.eligible).toBe(false);
    expect(data.reason).toMatch(/profile not found/i);
  });

  it("returns eligible=false when profile is not public", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockDbWithProfile({ github: "gh", discord: "dc", visibility: { isPublic: false, showDiscord: true } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.eligible).toBe(false);
    expect(data.reason).toMatch(/public/i);
  });

  it("returns eligible=false when GitHub is not connected", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockDbWithProfile({ discord: "dc", visibility: { isPublic: true, showDiscord: true } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.eligible).toBe(false);
    expect(data.reason).toMatch(/github/i);
  });

  it("returns eligible=false when Discord is not connected", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockDbWithProfile({ github: "gh", visibility: { isPublic: true, showDiscord: true } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.eligible).toBe(false);
    expect(data.reason).toMatch(/discord/i);
  });

  it("returns eligible=false when showDiscord is off", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockDbWithProfile({ github: "gh", discord: "dc", visibility: { isPublic: true, showDiscord: false } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.eligible).toBe(false);
    expect(data.reason).toMatch(/show discord/i);
  });

  it("returns eligible=false when user left a team this month", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockDbWithProfile(FULL_PROFILE, true);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.eligible).toBe(false);
    expect(data.reason).toMatch(/left a team/i);
  });

  it("returns eligible=true when all conditions are met", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockDbWithProfile(FULL_PROFILE, false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.eligible).toBe(true);
  });

  it("uses hackathonId from query parameter when provided", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    const docMock = jest.fn();
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "users") {
          return {
            doc: jest.fn(() => ({
              get: jest.fn(async () => ({
                exists: true,
                data: () => FULL_PROFILE,
              })),
            })),
          };
        }
        if (name === "hackathonLeftTeam") {
          return {
            doc: docMock.mockReturnValue({
              get: jest.fn(async () => ({ exists: false })),
            }),
          };
        }
        return { doc: jest.fn() };
      }),
    } as never);

    const res = await GET(makeRequest("hackathonId=custom-hack-2026"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.eligible).toBe(true);
    expect(docMock).toHaveBeenCalledWith("u1_custom-hack-2026");
  });
});
