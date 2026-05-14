/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/community/my-reactions/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "ip:127.0.0.1"),
  checkRateLimit: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockClientId = getClientIdentifier as jest.MockedFunction<typeof getClientIdentifier>;

function reactionsRequest(messageIds: string | null) {
  const url = new URL("http://localhost/api/community/my-reactions");
  if (messageIds !== null) url.searchParams.set("messageIds", messageIds);
  return new NextRequest(url, { method: "GET" });
}

/** Build a Firestore mock that returns the supplied reaction docs. */
function buildDb(reactionDocs: Array<{ messageId: string; type: string }>) {
  const get = jest.fn().mockResolvedValue({
    docs: reactionDocs.map((data) => ({ data: () => data })),
  });
  const whereChain = {
    where: jest.fn().mockReturnThis(),
    get,
  };
  const db: any = {
    collection: jest.fn(() => whereChain),
  };
  return { db, get, whereChain };
}

describe("GET /api/community/my-reactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientId.mockReturnValue("ip:127.0.0.1");
    mockRateLimit.mockReturnValue({ success: true } as any);
  });

  it("returns 429 when rate-limited (gate runs before auth)", async () => {
    mockRateLimit.mockReturnValue({ success: false, retryAfter: 42 } as any);
    const res = await GET(reactionsRequest("a"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    // Auth should not be checked when rate limit rejects
    expect(mockGetVerifiedUser).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(reactionsRequest("a,b,c"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when the messageIds query is empty/missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const res = await GET(reactionsRequest(""));
    expect(res.status).toBe(400);
  });

  it("returns an empty reactions object when messageIds resolves to no ids after trim", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const res = await GET(reactionsRequest(" , , ,"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reactions: {} });
  });

  it("returns 500 when admin DB is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    mockGetAdminDb.mockReturnValue(null as any);
    const res = await GET(reactionsRequest("m1,m2"));
    expect(res.status).toBe(500);
  });

  it("returns the reactions for the requested message IDs", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db } = buildDb([
      { messageId: "m1", type: "like" },
      { messageId: "m2", type: "dislike" },
    ]);
    mockGetAdminDb.mockReturnValue(db);

    const res = await GET(reactionsRequest("m1,m2"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reactions).toEqual({ m1: "like", m2: "dislike" });
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=15");
  });

  it("ignores reaction docs with unknown reaction types", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db } = buildDb([
      { messageId: "m1", type: "like" },
      { messageId: "m2", type: "celebrate" }, // not like/dislike → dropped
    ]);
    mockGetAdminDb.mockReturnValue(db);

    const res = await GET(reactionsRequest("m1,m2"));
    const json = await res.json();
    expect(json.reactions).toEqual({ m1: "like" });
  });

  it("dedupes message IDs and chunks the Firestore IN query into batches of 10", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db, get } = buildDb([{ messageId: "m1", type: "like" }]);
    mockGetAdminDb.mockReturnValue(db);

    // 15 unique IDs (with one dupe) → 2 chunks of 10 + remainder
    const ids = Array.from({ length: 15 }, (_, i) => `m${i}`).concat("m0").join(",");
    await GET(reactionsRequest(ids));

    // chunk(messageIds, 10) → 2 calls
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when the Firestore query throws", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const whereChain = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockRejectedValue(new Error("firestore-down")),
    };
    const db: any = { collection: jest.fn(() => whereChain) };
    mockGetAdminDb.mockReturnValue(db);
    const res = await GET(reactionsRequest("m1,m2"));
    expect(res.status).toBe(500);
  });
});
