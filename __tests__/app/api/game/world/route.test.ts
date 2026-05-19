/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — game world route snapshot + auth guards.
 */
import { GET } from "@/app/api/game/world/route";
import {
  getAllMapTilesServer,
  getAllOwnerSummariesServer,
} from "@/lib/game/data-server";
import { readWorldSnapshotServer } from "@/lib/game/world-snapshot";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  getAllMapTilesServer: jest.fn(),
  getAllOwnerSummariesServer: jest.fn(),
  getMapTilesInBoundsServer: jest.fn(),
}));

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
});
