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

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(async () => ({ success: true, remaining: 9, resetTime: Date.now() + 60000 })),
}));

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

  it("tags website signups with lumaRegistered based on email/GitHub match against hackathonLumaRegistrants", async () => {
    mockGetOptionalVerifiedUser.mockResolvedValue(null);

    // Two website signups + three Luma rows:
    //   - alice: email match → lumaRegistered=true
    //   - bob:   no email match but github login match → lumaRegistered=true
    //   - carol: no match in Luma → lumaRegistered=false
    //   - dave:  Luma-only (no website signup) → appears as userId=null row with lumaRegistered=true
    const aliceId = "alice-uid";
    const bobId = "bob-uid";
    const carolId = "carol-uid";
    const signupDocs = [
      { id: `${VALID_EVENT_ID}__${aliceId}`, data: () => ({ userId: aliceId, eventId: VALID_EVENT_ID, signedUpAt: new Date("2026-04-20") }) },
      { id: `${VALID_EVENT_ID}__${bobId}`, data: () => ({ userId: bobId, eventId: VALID_EVENT_ID, signedUpAt: new Date("2026-04-21") }) },
      { id: `${VALID_EVENT_ID}__${carolId}`, data: () => ({ userId: carolId, eventId: VALID_EVENT_ID, signedUpAt: new Date("2026-04-22") }) },
    ];
    const userDocs = [
      { exists: true, id: aliceId, data: () => ({ displayName: "Alice", email: "alice@example.com", github: { login: "alice-gh" } }) },
      { exists: true, id: bobId, data: () => ({ displayName: "Bob", email: "bob-website@example.com", github: { login: "bob-gh" } }) },
      { exists: true, id: carolId, data: () => ({ displayName: "Carol", email: "carol@example.com", github: { login: "carol-gh" } }) },
    ];
    const lumaDocs = [
      { id: "l1", data: () => ({ eventId: VALID_EVENT_ID, email: "alice@example.com", name: "Alice", lumaCreatedAt: "2026-04-10T00:00:00Z" }) },
      { id: "l2", data: () => ({ eventId: VALID_EVENT_ID, email: "bob-luma@example.com", githubLogin: "bob-gh", name: "Bob", lumaCreatedAt: "2026-04-11T00:00:00Z" }) },
      { id: "l3", data: () => ({ eventId: VALID_EVENT_ID, email: "dave@example.com", name: "Dave (luma only)", lumaCreatedAt: "2026-04-12T00:00:00Z" }) },
    ];

    const signupsCol = makeMockCollection(signupDocs);
    const lumaCol = makeMockCollection(lumaDocs);
    const prCol = makeMockCollection([]);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "hackathonEventSignups") return signupsCol;
        if (name === "hackathonLumaRegistrants") return lumaCol;
        if (name === "pullRequests") return prCol;
        if (name === "users") return { doc: jest.fn() };
        return makeMockCollection();
      }),
      getAll: jest.fn(async () => userDocs),
    } as never);

    const req = makeRequest("GET");
    const res = await GET(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    const json = await res.json();

    const byName: Record<string, { lumaRegistered: boolean; userId: string | null }> = {};
    for (const e of json.entries) byName[e.displayName] = { lumaRegistered: e.lumaRegistered, userId: e.userId };

    // Alice: website signup with email that matches a Luma row
    expect(byName["Alice"]).toBeDefined();
    expect(byName["Alice"].lumaRegistered).toBe(true);
    expect(byName["Alice"].userId).toBe(aliceId);

    // Bob: website email differs from Luma email but github login matches
    expect(byName["Bob"]).toBeDefined();
    expect(byName["Bob"].lumaRegistered).toBe(true);
    expect(byName["Bob"].userId).toBe(bobId);

    // Carol: website-only, no Luma match
    expect(byName["Carol"]).toBeDefined();
    expect(byName["Carol"].lumaRegistered).toBe(false);
    expect(byName["Carol"].userId).toBe(carolId);

    // Dave: Luma-only, no website signup → userId=null, lumaRegistered=true
    expect(byName["Dave (luma only)"]).toBeDefined();
    expect(byName["Dave (luma only)"].lumaRegistered).toBe(true);
    expect(byName["Dave (luma only)"].userId).toBeNull();
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
