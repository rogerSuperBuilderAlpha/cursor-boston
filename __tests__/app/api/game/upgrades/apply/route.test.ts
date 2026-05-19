/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — POST /api/game/upgrades/apply.
 */
import { POST } from "@/app/api/game/upgrades/apply/route";
import { applyUpgradeServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  applyUpgradeServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockApply = applyUpgradeServer as jest.MockedFunction<typeof applyUpgradeServer>;

describe("POST /api/game/upgrades/apply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockApply.mockResolvedValue({ player: { userId: "u1", displayName: "Ada" } } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/upgrades/apply",
        body: { targetId: "tile:t1", upgradeId: "u1" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/upgrades/apply",
        body: { targetId: "", upgradeId: "x" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("returns 200 when apply succeeds", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/upgrades/apply",
          body: { targetId: "tile:t1", upgradeId: "forge-1" },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      player: { displayName: "Ada" },
    });
    expect(mockApply).toHaveBeenCalledWith({
      userId: "u1",
      targetId: "tile:t1",
      upgradeId: "forge-1",
    });
  });
});
