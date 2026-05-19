/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — game world route snapshot + auth guards.
 */
import { GET } from "@/app/api/game/world/route";
import {
  getAllMapTilesServer,
  getAllOwnerSummariesServer,
  getMapTilesInBoundsServer,
} from "@/lib/game/data-server";
import { readWorldSnapshotServer } from "@/lib/game/world-snapshot";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => {
  const actual = jest.requireActual("@/lib/game/data-server");
  return {
    ...actual,
    getAllMapTilesServer: jest.fn(),
    getAllOwnerSummariesServer: jest.fn(),
    getMapTilesInBoundsServer: jest.fn(),
  };
});

jest.mock("@/lib/game/world-snapshot", () => ({
  readWorldSnapshotServer: jest.fn(),
  filterSnapshotToBbox: jest.fn((snapshot, bbox) =>
    snapshot.tiles.filter(
      (t: { q: number; r: number }) =>
        t.q >= bbox.qMin &&
        t.q <= bbox.qMax &&
        t.r >= bbox.rMin &&
        t.r <= bbox.rMax,
    ),
  ),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockReadSnapshot = readWorldSnapshotServer as jest.MockedFunction<
  typeof readWorldSnapshotServer
>;
const mockGetAllTiles = getAllMapTilesServer as jest.MockedFunction<
  typeof getAllMapTilesServer
>;
const mockGetOwners = getAllOwnerSummariesServer as jest.MockedFunction<
  typeof getAllOwnerSummariesServer
>;
const mockGetBbox = getMapTilesInBoundsServer as jest.MockedFunction<
  typeof getMapTilesInBoundsServer
>;

describe("GET /api/game/world", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest({ path: "/api/game/world" }));
    expect(res.status).toBe(401);
  });

  it("returns snapshot payload when cached snapshot exists", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockReadSnapshot.mockResolvedValue({
      snapshot: {
        tiles: [{ id: "t1", q: 0, r: 0 }],
        owners: [{ userId: "u1" }],
        generatedAt: "2026-05-18T00:00:00.000Z",
      },
      isStale: false,
    } as never);

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/game/world" })),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      tiles: [{ id: "t1" }],
      owners: [{ userId: "u1" }],
    });
    expect(mockGetAllTiles).not.toHaveBeenCalled();
  });

  it("falls back to live queries when snapshot is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockReadSnapshot.mockResolvedValue(null);
    mockGetAllTiles.mockResolvedValue([{ id: "live-tile" }] as never);
    mockGetOwners.mockResolvedValue([{ userId: "u2" }] as never);

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/game/world" })),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      tiles: [{ id: "live-tile" }],
      owners: [{ userId: "u2" }],
    });
  });

  it("returns bbox-filtered tiles from the snapshot (omits owners)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockReadSnapshot.mockResolvedValue({
      snapshot: {
        tiles: [
          { id: "t1", q: 0, r: 0 },
          { id: "t2", q: 5, r: 5 },
          { id: "t3", q: 10, r: 10 },
        ],
        owners: [{ userId: "u1" }],
        generatedAt: "2026-05-18T00:00:00.000Z",
      },
      isStale: false,
    } as never);

    const { status, body } = await readJson(
      await GET(
        makeAuthedRequest({
          path: "/api/game/world",
          searchParams: { qMin: "0", qMax: "5", rMin: "0", rMax: "5" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body.tiles).toEqual([
      { id: "t1", q: 0, r: 0 },
      { id: "t2", q: 5, r: 5 },
    ]);
    expect(body.owners).toBeUndefined();
  });

  it("sets X-World-Snapshot-Stale header when snapshot is stale", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockReadSnapshot.mockResolvedValue({
      snapshot: {
        tiles: [],
        owners: [],
        generatedAt: "2026-05-17T00:00:00.000Z",
      },
      isStale: true,
    } as never);

    const res = await GET(makeAuthedRequest({ path: "/api/game/world" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-World-Snapshot-Stale")).toBe("true");
    expect(res.headers.get("X-World-Snapshot-GeneratedAt")).toBe(
      "2026-05-17T00:00:00.000Z",
    );
  });

  it("falls back to bbox-only live query when snapshot is missing and bbox set", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockReadSnapshot.mockResolvedValue(null);
    mockGetBbox.mockResolvedValue([{ id: "bbox-tile" }] as never);

    const { status, body } = await readJson(
      await GET(
        makeAuthedRequest({
          path: "/api/game/world",
          searchParams: { qMin: "0", qMax: "5", rMin: "0", rMax: "5" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body.tiles).toEqual([{ id: "bbox-tile" }]);
    expect(body.owners).toBeUndefined();
    expect(mockGetBbox).toHaveBeenCalledWith({
      qMin: 0,
      qMax: 5,
      rMin: 0,
      rMax: 5,
    });
    expect(mockGetAllTiles).not.toHaveBeenCalled();
  });

  describe("bbox parsing — null bbox when invalid", () => {
    beforeEach(() => {
      mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
      mockReadSnapshot.mockResolvedValue({
        snapshot: {
          tiles: [{ id: "t-full", q: 0, r: 0 }],
          owners: [{ userId: "u1" }],
          generatedAt: "2026-05-18T00:00:00.000Z",
        },
        isStale: false,
      } as never);
    });

    it.each([
      ["missing one param", { qMin: "0", qMax: "5", rMin: "0" }],
      ["non-finite (NaN)", { qMin: "abc", qMax: "5", rMin: "0", rMax: "5" }],
      ["inverted qMin>qMax", { qMin: "10", qMax: "5", rMin: "0", rMax: "5" }],
      ["inverted rMin>rMax", { qMin: "0", qMax: "5", rMin: "10", rMax: "5" }],
    ])("falls through to full-world response when bbox is %s", async (_label, params) => {
      const { status, body } = await readJson(
        await GET(
          makeAuthedRequest({ path: "/api/game/world", searchParams: params }),
        ),
      );
      // With a null bbox the route returns full tiles + owners from the snapshot.
      expect(status).toBe(200);
      expect(body.tiles).toEqual([{ id: "t-full", q: 0, r: 0 }]);
      expect(body.owners).toEqual([{ userId: "u1" }]);
    });
  });

  it("returns 500 via mapGameError when the snapshot read throws", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockReadSnapshot.mockRejectedValue(new Error("snapshot read failed"));
    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/game/world" })),
    );
    expect(status).toBe(500);
    expect(body.error.code).toBe("SERVER_ERROR");
  });
});
