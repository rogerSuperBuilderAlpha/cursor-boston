/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/community/feed/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { getOptionalVerifiedUser } from "@/lib/server-auth";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));
jest.mock("@/lib/server-auth", () => ({
  getOptionalVerifiedUser: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "client-1"),
  checkRateLimit: jest.fn(() => ({ success: true })),
}));
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockGetOptionalVerifiedUser = getOptionalVerifiedUser as jest.MockedFunction<
  typeof getOptionalVerifiedUser
>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

type Row = {
  id: string;
  data: Record<string, unknown>;
};

function doc(row: Row) {
  return {
    id: row.id,
    exists: true,
    data: () => row.data,
  };
}

function makeRequest(path = "/api/community/feed") {
  return new NextRequest(`http://localhost${path}`);
}

function buildDb(opts: {
  rows: Row[];
  users?: Record<string, Record<string, unknown>>;
  blocked?: string[];
}) {
  const query: any = {
    limit: jest.fn(() => query),
    startAfter: jest.fn(() => query),
    get: jest.fn(async () => ({ docs: opts.rows.map(doc) })),
  };
  const communityMessages = {
    orderBy: jest.fn(() => query),
    doc: jest.fn((id: string) => ({
      get: jest.fn(async () => {
        const row = opts.rows.find((candidate) => candidate.id === id);
        return row ? doc(row) : { id, exists: false, data: () => undefined };
      }),
    })),
  };
  const users = {
    doc: jest.fn((id: string) => ({
      get: jest.fn(async () => {
        const data = opts.users?.[id];
        return { id, exists: Boolean(data), data: () => data };
      }),
    })),
  };
  const blocked = {
    limit: jest.fn(() => blocked),
    get: jest.fn(async () => ({
      docs: (opts.blocked ?? []).map((id) => doc({ id, data: { targetUid: id } })),
    })),
  };
  const userBlocks = {
    doc: jest.fn(() => ({ collection: jest.fn(() => blocked) })),
  };
  const db = {
    collection: jest.fn((name: string) => {
      if (name === "communityMessages") return communityMessages;
      if (name === "users") return users;
      if (name === "userBlocks") return userBlocks;
      throw new Error(`unexpected collection ${name}`);
    }),
  };
  return { db, query, communityMessages, users, blocked };
}

const createdAt = { toDate: () => new Date("2026-01-01T00:00:00.000Z") };

function row(id: string, overrides: Record<string, unknown> = {}): Row {
  return {
    id,
    data: {
      content: `message ${id}`,
      authorId: `author-${id}`,
      authorName: `Author ${id}`,
      authorPhoto: null,
      createdAt,
      likeCount: 0,
      dislikeCount: 0,
      replyCount: 0,
      repostCount: 0,
      ...overrides,
    },
  };
}

describe("GET /api/community/feed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOptionalVerifiedUser.mockResolvedValue({ uid: "viewer" });
    mockCheckRateLimit.mockReturnValue({ success: true } as never);
  });

  it("filters hidden messages, replies, suspended authors, and blocked authors", async () => {
    const { db } = buildDb({
      rows: [
        row("visible-1", { authorId: "author-visible-1" }),
        row("hidden", { hidden: true, authorId: "author-hidden" }),
        row("reply", { parentId: "parent-1", authorId: "author-reply" }),
        row("suspended", { authorId: "author-suspended" }),
        row("blocked", { authorId: "author-blocked" }),
        row("visible-2", { authorId: "author-visible-2" }),
      ],
      users: {
        "author-suspended": { suspended: true },
      },
      blocked: ["author-blocked"],
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages.map((message: { id: string }) => message.id)).toEqual([
      "visible-1",
      "visible-2",
    ]);
  });

  it("returns visible replies for a requested parent in ascending order", async () => {
    const { db, communityMessages } = buildDb({
      rows: [
        row("top-level", { authorId: "author-top" }),
        row("reply-1", { parentId: "parent-1", authorId: "author-reply-1" }),
        row("reply-hidden", { parentId: "parent-1", hidden: true, authorId: "author-hidden" }),
        row("reply-2", { parentId: "parent-1", authorId: "author-reply-2" }),
      ],
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET(makeRequest("/api/community/feed?parentId=parent-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages.map((message: { id: string }) => message.id)).toEqual([
      "reply-1",
      "reply-2",
    ]);
    expect(communityMessages.orderBy).toHaveBeenCalledWith("createdAt", "asc");
  });

  it("uses the last returned visible message as the next cursor when a page fills", async () => {
    const { db } = buildDb({
      rows: [
        row("first", { authorId: "author-first" }),
        row("second", { authorId: "author-second" }),
      ],
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET(makeRequest("/api/community/feed?limit=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages.map((message: { id: string }) => message.id)).toEqual(["first"]);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe("first");
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 42 } as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });
});
