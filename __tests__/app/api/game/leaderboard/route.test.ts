/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — game leaderboard query validation + success.
 */
import { GET } from "@/app/api/game/leaderboard/route";
import { getLeaderboardServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  getLeaderboardServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetLeaderboard = getLeaderboardServer as jest.MockedFunction<
  typeof getLeaderboardServer
>;

describe("GET /api/game/leaderboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockGetLeaderboard.mockResolvedValue({
      items: [
        {
          userId: "u1",
          displayName: "Ada",
          caste: "red",
          phase: "active",
          stats: { tilesHeld: 5, unitsAlive: 10, attacksWon: 2, attacksLost: 1 },
        },
      ],
      nextCursor: null,
      hasMore: false,
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest({ path: "/api/game/leaderboard" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid audience query", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await GET(
      makeAuthedRequest({
        path: "/api/game/leaderboard",
        searchParams: { audience: "bots" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns paginated leaderboard for authed user", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status, body } = await readJson(
      await GET(
        makeAuthedRequest({
          path: "/api/game/leaderboard",
          searchParams: { limit: "10", audience: "real" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      players: [
        expect.objectContaining({
          userId: "u1",
          displayName: "Ada",
          tilesHeld: 5,
        }),
      ],
      hasMore: false,
    });
    expect(mockGetLeaderboard).toHaveBeenCalledWith(
      expect.objectContaining({ audience: "real" }),
    );
  });
});
