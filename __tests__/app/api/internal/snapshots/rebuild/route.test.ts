/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const mockSet = jest.fn().mockResolvedValue(undefined);
const mockCollection = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/analytics-snapshot-compute", () => ({
  computeAnalyticsSummary: jest.fn().mockResolvedValue({ totalUsers: 10 }),
  ANALYTICS_SNAPSHOT_CACHE_TTL_MS: 3_600_000,
}));

jest.mock("@/lib/members-public-snapshot", () => ({
  computePublicMembersSnapshot: jest.fn().mockResolvedValue([{ id: "m1" }]),
  MEMBERS_SNAPSHOT_CACHE_TTL_MS: 3_600_000,
}));

jest.mock("@/lib/game/world-snapshot", () => ({
  rebuildWorldSnapshotServer: jest.fn().mockResolvedValue({
    tileCount: 42,
    ownerCount: 7,
  }),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    logError: jest.fn(),
  },
}));

function wireFirestore({
  analyticsUpdatedAt,
  membersUpdatedAt,
  gameWorldGeneratedAt,
}: {
  analyticsUpdatedAt?: Date;
  membersUpdatedAt?: Date;
  gameWorldGeneratedAt?: Date;
} = {}) {
  mockCollection.mockImplementation((name: string) => ({
    doc: (id: string) => ({
      get: async () => ({
        data: () => {
          if (name === "analytics_snapshots" && id === "latest") {
            return analyticsUpdatedAt
              ? { updatedAt: { toDate: () => analyticsUpdatedAt } }
              : undefined;
          }
          if (name === "members_snapshots" && id === "latest") {
            return membersUpdatedAt
              ? { updatedAt: { toDate: () => membersUpdatedAt } }
              : undefined;
          }
          if (name === "game_world_snapshots" && id === "latest") {
            return gameWorldGeneratedAt
              ? { generatedAt: { toDate: () => gameWorldGeneratedAt } }
              : undefined;
          }
          return undefined;
        },
      }),
      set: mockSet,
    }),
  }));
}

function makeReq(query = "", headers: Record<string, string> = {}) {
  return new NextRequest(
    `https://cursorboston.com/api/internal/snapshots/rebuild${query}`,
    { method: "GET", headers }
  );
}

async function loadRoute(cronSecret?: string) {
  jest.resetModules();
  if (cronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = cronSecret;
  }

  const route = await import("@/app/api/internal/snapshots/rebuild/route");
  const { getAdminDb } = await import("@/lib/firebase-admin");
  const { computeAnalyticsSummary } = await import(
    "@/lib/analytics-snapshot-compute"
  );
  const { computePublicMembersSnapshot } = await import(
    "@/lib/members-public-snapshot"
  );
  const { rebuildWorldSnapshotServer } = await import(
    "@/lib/game/world-snapshot"
  );

  wireFirestore();
  (getAdminDb as jest.Mock).mockReturnValue({ collection: mockCollection });

  return {
    GET: route.GET,
    POST: route.POST,
    getAdminDb: getAdminDb as jest.Mock,
    computeAnalyticsSummary: computeAnalyticsSummary as jest.Mock,
    computePublicMembersSnapshot: computePublicMembersSnapshot as jest.Mock,
    rebuildWorldSnapshotServer: rebuildWorldSnapshotServer as jest.Mock,
  };
}

describe("/api/internal/snapshots/rebuild", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    mockSet.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    const { GET } = await loadRoute(undefined);
    const res = await GET(makeReq("", { "x-cron-secret": "anything" }));
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/CRON_SECRET not set/i);
  });

  it("returns 401 without a valid cron secret", async () => {
    const { GET, computeAnalyticsSummary } = await loadRoute("cron-test-secret");
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/Unauthorized/i);
    expect(computeAnalyticsSummary).not.toHaveBeenCalled();
  });

  it("accepts the secret via Authorization Bearer header", async () => {
    const { GET } = await loadRoute("cron-test-secret");
    const res = await GET(
      makeReq("", { authorization: "Bearer cron-test-secret" })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; analytics?: { ok: boolean } };
    expect(json.ok).toBe(true);
    expect(json.analytics?.ok).toBe(true);
  });

  it("returns 500 when admin db is unavailable", async () => {
    const { POST, getAdminDb } = await loadRoute("cron-test-secret");
    getAdminDb.mockReturnValue(null);
    const res = await POST(makeReq("", { "x-cron-secret": "cron-test-secret" }));
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/not configured/i);
  });

  it("rebuilds analytics and members by default", async () => {
    const {
      GET,
      computeAnalyticsSummary,
      computePublicMembersSnapshot,
      rebuildWorldSnapshotServer,
    } = await loadRoute("cron-test-secret");

    const res = await GET(
      makeReq("", { "x-cron-secret": "cron-test-secret" })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      analytics?: { ok: boolean };
      members?: { ok: boolean; count?: number };
      gameWorld?: unknown;
    };
    expect(json.ok).toBe(true);
    expect(json.analytics?.ok).toBe(true);
    expect(json.members?.ok).toBe(true);
    expect(json.members?.count).toBe(1);
    expect(json.gameWorld).toBeUndefined();
    expect(computeAnalyticsSummary).toHaveBeenCalled();
    expect(computePublicMembersSnapshot).toHaveBeenCalled();
    expect(rebuildWorldSnapshotServer).not.toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it("skips fresh analytics snapshots unless force=true", async () => {
    jest.resetModules();
    process.env.CRON_SECRET = "cron-test-secret";
    mockCollection.mockImplementation((name: string) => ({
      doc: (id: string) => ({
        get: async () => ({
          data: () => {
            if (name === "analytics_snapshots" && id === "latest") {
              return { updatedAt: { toDate: () => new Date() } };
            }
            if (name === "members_snapshots" && id === "latest") {
              return {
                updatedAt: {
                  toDate: () => new Date(Date.now() - 6 * 60 * 60 * 1000),
                },
              };
            }
            return undefined;
          },
        }),
        set: mockSet,
      }),
    }));

    const route = await import("@/app/api/internal/snapshots/rebuild/route");
    const { getAdminDb } = await import("@/lib/firebase-admin");
    const { computeAnalyticsSummary } = await import(
      "@/lib/analytics-snapshot-compute"
    );
    const { computePublicMembersSnapshot } = await import(
      "@/lib/members-public-snapshot"
    );
    (getAdminDb as jest.Mock).mockReturnValue({ collection: mockCollection });

    const res = await route.GET(
      makeReq("", { "x-cron-secret": "cron-test-secret" })
    );
    const json = (await res.json()) as {
      analytics?: { ok: boolean; error?: string };
      members?: { ok: boolean };
    };
    expect(json.analytics?.error).toMatch(/skipped/i);
    expect(computeAnalyticsSummary).not.toHaveBeenCalled();
    expect(json.members?.ok).toBe(true);
    expect(computePublicMembersSnapshot).toHaveBeenCalled();
  });

  it("rebuilds only game-world when only=game-world", async () => {
    const {
      GET,
      computeAnalyticsSummary,
      rebuildWorldSnapshotServer,
    } = await loadRoute("cron-test-secret");

    const res = await GET(
      makeReq("?only=game-world", { "x-cron-secret": "cron-test-secret" })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      gameWorld?: { ok: boolean; tileCount?: number; ownerCount?: number };
      analytics?: unknown;
      members?: unknown;
    };
    expect(json.ok).toBe(true);
    expect(json.gameWorld).toEqual({ ok: true, tileCount: 42, ownerCount: 7 });
    expect(json.analytics).toBeUndefined();
    expect(json.members).toBeUndefined();
    expect(rebuildWorldSnapshotServer).toHaveBeenCalled();
    expect(computeAnalyticsSummary).not.toHaveBeenCalled();
  });

  it("returns 500 when a rebuild phase throws", async () => {
    const { GET, computeAnalyticsSummary } = await loadRoute("cron-test-secret");
    computeAnalyticsSummary.mockRejectedValueOnce(new Error("analytics blew up"));

    const res = await GET(
      makeReq("?only=analytics&force=true", {
        "x-cron-secret": "cron-test-secret",
      })
    );
    expect(res.status).toBe(500);
    const json = (await res.json()) as {
      ok: boolean;
      analytics?: { ok: boolean; error?: string };
    };
    expect(json.ok).toBe(false);
    expect(json.analytics?.ok).toBe(false);
    expect(json.analytics?.error).toMatch(/analytics blew up/i);
  });
});
