/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "@/app/api/hackathons/events/[eventId]/signup/route";
import { getVerifiedUser, getOptionalVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";

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
  getOptionalVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/github-merged-pr-count", () => ({
  fetchMergedPrCountsForLogins: jest.fn(async () => new Map()),
}));

jest.mock("@/lib/github-recent-merged-prs", () => ({
  getGithubRepoPair: jest.fn(() => ({ owner: "test", repo: "repo" })),
}));

jest.mock("@/lib/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetOptionalVerifiedUser = getOptionalVerifiedUser as jest.MockedFunction<typeof getOptionalVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

const VALID_EVENT_ID = "hack-a-sprint-2026";

function makeContext(eventId: string) {
  return { params: Promise.resolve({ eventId }) };
}

function makeRequest(method: string, body?: unknown) {
  const opts: RequestInit = { method };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  return new NextRequest("http://localhost/api/hackathons/events/test/signup", opts);
}

/* ---------- Firestore mock helpers ---------- */

function makeMockDoc(data: Record<string, unknown> | null) {
  return {
    exists: data !== null,
    id: "doc-id",
    data: () => data,
  };
}

function makeMockCollection(docs: Array<{ id: string; data: () => Record<string, unknown> }> = []) {
  return {
    where: jest.fn().mockReturnThis(),
    get: jest.fn(async () => ({ docs })),
  };
}

describe("GET /api/hackathons/events/[eventId]/signup", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 for unknown event ID", async () => {
    mockGetOptionalVerifiedUser.mockResolvedValue(null);
    const req = makeRequest("GET");
    const res = await GET(req, makeContext("invalid-event"));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Unknown event");
  });

  it("returns 500 when db is not configured", async () => {
    mockGetOptionalVerifiedUser.mockResolvedValue(null);
    mockGetAdminDb.mockReturnValue(null as never);
    const req = makeRequest("GET");
    const res = await GET(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(500);
  });

  it("returns entries with empty signups", async () => {
    mockGetOptionalVerifiedUser.mockResolvedValue(null);
    const signupsCol = makeMockCollection([]);
    const lumaCol = makeMockCollection([]);
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "hackathonEventSignups") return signupsCol;
        if (name === "hackathonLumaRegistrants") return lumaCol;
        return makeMockCollection();
      }),
      getAll: jest.fn(async () => []),
    } as never);

    const req = makeRequest("GET");
    const res = await GET(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.eventId).toBe(VALID_EVENT_ID);
    expect(json.entries).toEqual([]);
    expect(json.totalCount).toBe(0);
    expect(json.me).toBeNull();
  });

  it("returns me object when user is authenticated and signed up", async () => {
    const userId = "user-1";
    mockGetOptionalVerifiedUser.mockResolvedValue({ uid: userId, email: "u@test.com" });

    const signupDoc = {
      id: `${VALID_EVENT_ID}__${userId}`,
      data: () => ({
        userId,
        eventId: VALID_EVENT_ID,
        signedUpAt: new Date("2026-01-01"),
      }),
    };

    const userDoc = {
      exists: true,
      id: userId,
      data: () => ({
        displayName: "Test User",
        github: { login: "testuser" },
        email: "u@test.com",
      }),
    };

    const signupsCol = makeMockCollection([signupDoc]);
    const lumaCol = makeMockCollection([]);
    const prCol = makeMockCollection([]);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "hackathonEventSignups") return signupsCol;
        if (name === "hackathonLumaRegistrants") return lumaCol;
        if (name === "pullRequests") return prCol;
        if (name === "users") return { doc: jest.fn(() => userDoc) };
        return makeMockCollection();
      }),
      getAll: jest.fn(async () => [userDoc]),
    } as never);

    const req = makeRequest("GET");
    const res = await GET(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.me).toBeDefined();
    expect(json.me.signedUp).toBe(true);
    expect(json.me.rank).toBe(1);
  });

  it("returns me.signedUp false when user is authenticated but not signed up", async () => {
    mockGetOptionalVerifiedUser.mockResolvedValue({ uid: "other-user", email: "o@test.com" });

    const signupsCol = makeMockCollection([]);
    const lumaCol = makeMockCollection([]);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "hackathonEventSignups") return signupsCol;
        if (name === "hackathonLumaRegistrants") return lumaCol;
        return makeMockCollection();
      }),
      getAll: jest.fn(async () => []),
    } as never);

    const req = makeRequest("GET");
    const res = await GET(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.me.signedUp).toBe(false);
    expect(json.me.rank).toBeNull();
  });
});

describe("POST /api/hackathons/events/[eventId]/signup", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const req = makeRequest("POST");
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown event ID", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com" });
    const req = makeRequest("POST");
    const res = await POST(req, makeContext("bad-event"));
    expect(res.status).toBe(404);
  });

  it("returns 500 when db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com" });
    mockGetAdminDb.mockReturnValue(null as never);
    const req = makeRequest("POST");
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(500);
  });

  it("returns 400 when user profile blocks signup", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com" });

    const userDoc = makeMockDoc({ visibility: { isPublic: false } });
    const signupDoc = makeMockDoc(null);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => ({
        doc: jest.fn(() => {
          if (name === "users") return { get: jest.fn(async () => userDoc) };
          return { get: jest.fn(async () => signupDoc) };
        }),
      })),
    } as never);

    const req = makeRequest("POST");
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("public");
  });

  it("returns already signed up when doc exists", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com" });

    const userDoc = makeMockDoc({
      visibility: { isPublic: true, showDiscord: true },
      github: { login: "test" },
      discord: { id: "123" },
    });

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => ({
        doc: jest.fn(() => {
          if (name === "users") return { get: jest.fn(async () => userDoc) };
          return { get: jest.fn(async () => makeMockDoc({ eventId: VALID_EVENT_ID, userId: "u1" })) };
        }),
      })),
    } as never);

    const req = makeRequest("POST");
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.alreadySignedUp).toBe(true);
  });

  it("creates signup and returns 200 on success", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com" });

    const userDoc = makeMockDoc({
      visibility: { isPublic: true, showDiscord: true },
      github: { login: "test" },
      discord: { id: "123" },
    });

    const setMock = jest.fn().mockResolvedValue(undefined);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => ({
        doc: jest.fn(() => {
          if (name === "users") return { get: jest.fn(async () => userDoc) };
          return {
            get: jest.fn(async () => makeMockDoc(null)),
            set: setMock,
          };
        }),
      })),
    } as never);

    const req = makeRequest("POST");
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signedUp).toBe(true);
    expect(json.alreadySignedUp).toBeUndefined();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: VALID_EVENT_ID,
        userId: "u1",
      })
    );
  });
});

describe("DELETE /api/hackathons/events/[eventId]/signup", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const req = makeRequest("DELETE");
    const res = await DELETE(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown event ID", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com" });
    const req = makeRequest("DELETE");
    const res = await DELETE(req, makeContext("bad-event"));
    expect(res.status).toBe(404);
  });

  it("returns 500 when db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com" });
    mockGetAdminDb.mockReturnValue(null as never);
    const req = makeRequest("DELETE");
    const res = await DELETE(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(500);
  });

  it("deletes signup doc and returns left: true", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com" });

    const deleteMock = jest.fn().mockResolvedValue(undefined);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          delete: deleteMock,
        })),
      })),
    } as never);

    const req = makeRequest("DELETE");
    const res = await DELETE(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.left).toBe(true);
    expect(deleteMock).toHaveBeenCalled();
  });
});
