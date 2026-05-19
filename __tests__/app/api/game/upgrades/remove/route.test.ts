/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — POST /api/game/upgrades/remove.
 */
import { POST } from "@/app/api/game/upgrades/remove/route";
import { removeUpgradeServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  removeUpgradeServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockRemove = removeUpgradeServer as jest.MockedFunction<typeof removeUpgradeServer>;

describe("POST /api/game/upgrades/remove", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockRemove.mockResolvedValue({ player: { userId: "u1" } } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/upgrades/remove",
        body: { targetId: "tile:t1" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when targetId missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/upgrades/remove",
        body: {},
      }),
    );
    expect(res.status).toBe(400);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("returns 200 when remove succeeds", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/upgrades/remove",
          body: { targetId: "tile:t99" },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(mockRemove).toHaveBeenCalledWith({ userId: "u1", targetId: "tile:t99" });
  });
});
