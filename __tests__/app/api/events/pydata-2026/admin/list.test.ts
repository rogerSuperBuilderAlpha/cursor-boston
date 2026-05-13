/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/events/pydata-2026/admin/list/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_cfg: unknown, handler: any) => handler,
  rateLimitConfigs: { standard: {} },
}));

const mockAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;

function tsLike(ms: number) {
  return { toMillis: () => ms };
}

function buildDb(rows: Array<{ id: string; data: Record<string, unknown> }>) {
  const docs = rows.map((row) => ({
    id: row.id,
    data: () => row.data,
  }));
  const get = jest.fn().mockResolvedValue({ docs });
  const orderBy = jest.fn().mockReturnValue({ get });
  const collection = { orderBy };
  const db: any = { collection: jest.fn().mockReturnValue(collection) };
  return { db, get, orderBy };
}

function req() {
  return new NextRequest("http://localhost/api/events/pydata-2026/admin/list", {
    method: "GET",
  });
}

describe("GET /api/events/pydata-2026/admin/list", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user is not an admin", async () => {
    mockUser.mockResolvedValue({ uid: "u1", isAdmin: false } as any);
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it("returns 500 when admin DB is not configured", async () => {
    mockUser.mockResolvedValue({ uid: "u1", isAdmin: true } as any);
    mockAdminDb.mockReturnValue(null as any);
    const res = await GET(req());
    expect(res.status).toBe(500);
  });

  it("returns empty registrations / zero counts when there are no docs", async () => {
    mockUser.mockResolvedValue({ uid: "u1", isAdmin: true } as any);
    const { db } = buildDb([]);
    mockAdminDb.mockReturnValue(db);
    const res = await GET(req());
    const json = await res.json();
    expect(json.total).toBe(0);
    expect(json.inCapCount).toBe(0);
    expect(json.waitlistCount).toBe(0);
    expect(json.registrations).toEqual([]);
  });

  it("normalizes unknown status values to 'awaiting-badge'", async () => {
    mockUser.mockResolvedValue({ uid: "u1", isAdmin: true } as any);
    const { db } = buildDb([
      {
        id: "u-alice",
        data: {
          firstName: "Alice",
          email: "alice@example.com",
          status: "bogus-status", // not in VALID_STATUSES
          createdAt: tsLike(1000),
        },
      },
    ]);
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET(req())).json();
    expect(json.registrations[0].status).toBe("awaiting-badge");
  });

  it("filters out rows where createdAt cannot be converted to ms", async () => {
    mockUser.mockResolvedValue({ uid: "u1", isAdmin: true } as any);
    const { db } = buildDb([
      {
        id: "u-bad",
        data: { firstName: "Bad", email: "bad@example.com" /* no createdAt */ },
      },
      {
        id: "u-good",
        data: {
          firstName: "Good",
          email: "good@example.com",
          status: "awaiting-badge",
          createdAt: tsLike(2000),
        },
      },
    ]);
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET(req())).json();
    expect(json.registrations).toHaveLength(1);
    expect(json.registrations[0].uid).toBe("u-good");
  });

  it("counts statuses and computes inCap vs waitlist", async () => {
    mockUser.mockResolvedValue({ uid: "u1", isAdmin: true } as any);
    // 3 awaiting-badge, 1 cancelled
    const { db } = buildDb([
      {
        id: "u1",
        data: {
          firstName: "A",
          email: "a@x.com",
          status: "awaiting-badge",
          createdAt: tsLike(1000),
        },
      },
      {
        id: "u2",
        data: {
          firstName: "B",
          email: "b@x.com",
          status: "checked-in",
          createdAt: tsLike(2000),
        },
      },
      {
        id: "u3",
        data: {
          firstName: "C",
          email: "c@x.com",
          status: "badge-ready",
          createdAt: tsLike(3000),
        },
      },
      {
        id: "u4",
        data: {
          firstName: "D",
          email: "d@x.com",
          status: "cancelled",
          createdAt: tsLike(4000),
        },
      },
    ]);
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET(req())).json();
    expect(json.total).toBe(4);
    expect(json.counts).toEqual({
      "awaiting-badge": 1,
      "checked-in": 1,
      "badge-ready": 1,
      cancelled: 1,
    });
    expect(json.inCapCount).toBe(3); // 3 non-cancelled within capacity
    expect(json.waitlistCount).toBe(0);
    expect(json.registrations.find((r: any) => r.uid === "u4").inCap).toBe(false);
    expect(json.registrations.find((r: any) => r.uid === "u1").inCap).toBe(true);
  });

  it("falls back to createdAt for updatedAt when updatedAt is missing", async () => {
    mockUser.mockResolvedValue({ uid: "u1", isAdmin: true } as any);
    const { db } = buildDb([
      {
        id: "u1",
        data: {
          firstName: "A",
          email: "a@x.com",
          status: "awaiting-badge",
          createdAt: tsLike(1234),
          // no updatedAt
        },
      },
    ]);
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET(req())).json();
    expect(json.registrations[0].updatedAt).toBe(1234);
  });
});
