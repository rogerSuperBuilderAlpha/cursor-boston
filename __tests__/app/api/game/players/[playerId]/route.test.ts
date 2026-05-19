/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — public player profile route.
 */
import { GET } from "@/app/api/game/players/[playerId]/route";
import { getPublicPlayerProfileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  getPublicPlayerProfileServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetProfile = getPublicPlayerProfileServer as jest.MockedFunction<
  typeof getPublicPlayerProfileServer
>;

const mockPlayer = {
  userId: "player-1",
  displayName: "General",
  caste: "blue" as const,
  phase: "play" as const,
  tilesExplored: 10,
  stats: { attacksWon: 0, attacksLost: 0, tilesHeld: 0, unitsAlive: 0 },
  heroCount: 0,
  armageddonSealsBroken: 0,
  seasonNumber: 1,
  bio: "",
  bioUpdatedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  turnsRemaining: 0,
  turnsSpentTotal: 0,
  shieldUntil: new Date(),
  shieldDropAtTurn: 0,
  productionSpellsActive: [],
  updatedAt: new Date(),
};

describe("GET /api/game/players/[playerId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest({ path: "/api/game/players/player-1" }), {
      params: Promise.resolve({ playerId: "player-1" }),
    });
    expect(res.status).toBe(401);
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it("returns 404 when player is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "viewer",
      email: "v@test.com",
      name: "V",
    });
    mockGetProfile.mockResolvedValue(null);

    const { status } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/game/players/missing" }), {
        params: Promise.resolve({ playerId: "missing" }),
      }),
    );

    expect(status).toBe(404);
  });

  it("returns public slice and titles for authed viewer", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "viewer",
      email: "v@test.com",
      name: "V",
    });
    mockGetProfile.mockResolvedValue(mockPlayer as never);

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/game/players/player-1" }), {
        params: Promise.resolve({ playerId: "player-1" }),
      }),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      player: {
        userId: "player-1",
        displayName: "General",
        caste: "blue",
      },
      titles: expect.any(Array),
    });
    expect(mockGetProfile).toHaveBeenCalledWith("player-1");
  });
});
