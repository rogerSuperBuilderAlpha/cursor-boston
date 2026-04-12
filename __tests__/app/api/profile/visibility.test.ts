/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/profile/visibility/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true })),
  getClientIdentifier: () => "test-client",
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: () => ({
      doc: () => ({ get: mockGet, update: mockUpdate }),
    }),
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const testUser: VerifiedUser = { uid: "u1", name: "Test" };

function makePatchRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/profile/visibility", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest() {
  return new NextRequest("http://localhost/api/profile/visibility");
}

describe("PATCH /api/profile/visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(testUser);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ isPublic: true }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no valid fields provided", async () => {
    const res = await PATCH(makePatchRequest({ invalidField: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-boolean values", async () => {
    const res = await PATCH(makePatchRequest({ isPublic: "yes" }));
    expect(res.status).toBe(400);
  });

  it("updates visibility fields and returns updated data", async () => {
    mockGet.mockResolvedValue({
      data: () => ({ visibility: { isPublic: true, showEmail: false } }),
    });
    const res = await PATCH(makePatchRequest({ isPublic: true, showEmail: false }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        "visibility.isPublic": true,
        "visibility.showEmail": false,
      })
    );
  });
});

describe("GET /api/profile/visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(testUser);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns default profile when user doc does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.hasDisplayName).toBe(false);
    expect(body.profile.hasGithub).toBe(false);
  });

  it("returns profile data when user doc exists", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        displayName: "Jane",
        github: { login: "janedoe" },
        discord: { username: "jane#1234" },
        visibility: { isPublic: true },
        photoURL: "https://example.com/photo.jpg",
      }),
    });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.hasDisplayName).toBe(true);
    expect(body.profile.hasGithub).toBe(true);
    expect(body.profile.githubUsername).toBe("janedoe");
    expect(body.profile.visibility.isPublic).toBe(true);
  });
});
