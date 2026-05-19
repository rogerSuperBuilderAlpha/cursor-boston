/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — game attack route validation + success path.
 */
import { POST } from "@/app/api/game/attack/route";
import { attackTileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  attackTileServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockAttackTileServer = attackTileServer as jest.MockedFunction<typeof attackTileServer>;

const VALID_BODY = {
  sourceTileId: "tile-a",
  targetTileId: "tile-b",
  units: { ground: 5, siege: 0, air: 0 },
};

describe("POST /api/game/attack", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({ method: "POST", path: "/api/game/attack", body: VALID_BODY }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/attack",
        body: "not-json",
        headers: { "content-type": "text/plain" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/attack",
        body: { sourceTileId: "tile-a" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 with attack result on success", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockAttackTileServer.mockResolvedValue({
      attack: { id: "atk-1" },
      attackerPlayer: { userId: "u1" },
      sourceTile: { id: "tile-a" },
      targetTile: { id: "tile-b" },
      report: { id: "rpt-1" },
      combat: { outcome: "win" },
    } as never);

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/attack",
          body: VALID_BODY,
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      attack: { id: "atk-1" },
      combat: { outcome: "win" },
    });
    expect(mockAttackTileServer).toHaveBeenCalledWith(
      expect.objectContaining({
        attackerId: "u1",
        sourceTileId: "tile-a",
        targetTileId: "tile-b",
      }),
    );
  });
});
