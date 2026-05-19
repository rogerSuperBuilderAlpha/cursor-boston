/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — game spell cast route validation + success.
 */
import { POST } from "@/app/api/game/spell/cast/route";
import { castSpellServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  castSpellServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockCastSpellServer = castSpellServer as jest.MockedFunction<typeof castSpellServer>;

const VALID_BODY = {
  spellId: "siege-1",
  sourceTileId: "tile-a",
  targetTileId: "tile-b",
};

describe("POST /api/game/spell/cast", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({ method: "POST", path: "/api/game/spell/cast", body: VALID_BODY }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when spellId is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/spell/cast",
        body: { sourceTileId: "tile-a", targetTileId: "tile-b" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 with spell result on success", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockCastSpellServer.mockResolvedValue({
      player: { userId: "u1" },
      report: { id: "rpt-1" },
      siege: { magnitudeApplied: 2, totalMagnitudeAfter: 2 },
    } as never);

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/spell/cast",
          body: VALID_BODY,
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      siege: { magnitudeApplied: 2 },
    });
    expect(mockCastSpellServer).toHaveBeenCalledWith(
      expect.objectContaining({
        attackerId: "u1",
        spellId: "siege-1",
      }),
    );
  });
});
