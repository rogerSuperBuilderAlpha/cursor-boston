/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/special-units/summon/route";
import { summonSpecialUnitServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  summonSpecialUnitServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockSummon = summonSpecialUnitServer as jest.MockedFunction<typeof summonSpecialUnitServer>;

describe("POST /api/game/special-units/summon", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        path: "/api/game/special-units/summon",
        method: "POST",
        body: { instanceId: "s1", targetTileId: "0_0" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("summons unit for authed user", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });
    mockSummon.mockResolvedValue({
      player: { userId: "u1" },
      tileId: "0_0",
    } as never);

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          path: "/api/game/special-units/summon",
          method: "POST",
          body: { instanceId: "s1", targetTileId: "0_0" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, tileId: "0_0" });
    expect(mockSummon).toHaveBeenCalledWith({
      userId: "u1",
      instanceId: "s1",
      targetTileId: "0_0",
    });
  });
});
