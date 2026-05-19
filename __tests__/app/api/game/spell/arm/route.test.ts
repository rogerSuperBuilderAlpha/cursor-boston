/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — POST /api/game/spell/arm single-tile batch.
 */
import { POST } from "@/app/api/game/spell/arm/route";
import { armDefenseSpellServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  armDefenseSpellServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockArmDefense = armDefenseSpellServer as jest.MockedFunction<typeof armDefenseSpellServer>;

describe("POST /api/game/spell/arm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockArmDefense.mockResolvedValue({
      player: { userId: "u1" },
      tile: { id: "t1" },
      report: { kind: "arm" },
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/spell/arm",
        body: { spellId: "shield", tileId: "t1" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when neither tileId nor tileIds provided", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/spell/arm",
        body: { spellId: "shield" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockArmDefense).not.toHaveBeenCalled();
  });

  it("returns 200 when single-tile arm succeeds", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/spell/arm",
          body: { spellId: "ward", tileId: "mine-1", count: 1 },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(mockArmDefense).toHaveBeenCalledWith("u1", "mine-1", "ward");
  });
});
