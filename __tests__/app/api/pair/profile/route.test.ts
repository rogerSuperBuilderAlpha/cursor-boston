/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/pair/profile/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getPairProfileServer,
  createOrUpdatePairProfileServer,
} from "@/lib/pair-programming/data-server";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/pair-programming/data-server", () => ({
  getPairProfileServer: jest.fn(),
  createOrUpdatePairProfileServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetProfile = getPairProfileServer as jest.MockedFunction<typeof getPairProfileServer>;
const mockCreateOrUpdate = createOrUpdatePairProfileServer as jest.MockedFunction<typeof createOrUpdatePairProfileServer>;

const testUser: VerifiedUser = { uid: "u1", name: "Test" };

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/pair/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest() {
  return new NextRequest("http://localhost/api/pair/profile");
}

const validBody = {
  skillsCanTeach: ["React"],
  skillsWantToLearn: ["Rust"],
  preferredLanguages: ["TypeScript"],
  preferredFrameworks: ["Next.js"],
  timezone: "America/New_York",
  availability: ["weekends"],
  sessionTypes: ["build-together"],
  bio: "Hello world",
  isActive: true,
};

describe("GET /api/pair/profile", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns profile when authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const profile = { userId: "u1", skillsCanTeach: ["React"] };
    mockGetProfile.mockResolvedValue(profile as any);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.profile).toEqual(profile);
  });

  it("returns null profile when none exists", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGetProfile.mockResolvedValue(null);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.profile).toBeNull();
  });

  it("returns 500 on internal error", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGetProfile.mockRejectedValue(new Error("db down"));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
  });
});

describe("POST /api/pair/profile", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when skills arrays are missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ ...validBody, skillsCanTeach: "not-array" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Skills arrays");
  });

  it("returns 400 when timezone is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ ...validBody, timezone: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Timezone");
  });

  it("returns 400 when sessionTypes is empty", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ ...validBody, sessionTypes: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("session type");
  });

  it("returns 400 for invalid session type", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ ...validBody, sessionTypes: ["invalid-type"] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid session type");
  });

  it("returns 400 when array exceeds max length", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const longArray = Array.from({ length: 21 }, (_, i) => `skill-${i}`);
    const res = await POST(makePostRequest({ ...validBody, skillsCanTeach: longArray }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("exceed");
  });

  it("returns 400 when array items are not valid strings", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ ...validBody, skillsCanTeach: [123] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid array items");
  });

  it("returns 400 when bio exceeds 1000 chars", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ ...validBody, bio: "x".repeat(1001) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Bio");
  });

  it("succeeds with valid body", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockCreateOrUpdate.mockResolvedValue(undefined);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("updated");
    expect(mockCreateOrUpdate).toHaveBeenCalledWith("u1", expect.objectContaining({
      skillsCanTeach: ["React"],
      timezone: "America/New_York",
    }));
  });

  it("returns 500 on internal error", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockCreateOrUpdate.mockRejectedValue(new Error("db down"));

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(500);
  });

  it("defaults isActive to true when not provided", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockCreateOrUpdate.mockResolvedValue(undefined);
    const { isActive, ...bodyWithout } = validBody;

    const res = await POST(makePostRequest(bodyWithout));
    expect(res.status).toBe(200);
    expect(mockCreateOrUpdate).toHaveBeenCalledWith("u1", expect.objectContaining({
      isActive: true,
    }));
  });
});
