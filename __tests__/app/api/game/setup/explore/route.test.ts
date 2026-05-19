/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/setup/explore/route";
import { exploreNextTileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  exploreNextTileServer: jest.fn(),
}));

describe("POST /api/game/setup/explore", () => {
  it("returns 200 on setup explore", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    (exploreNextTileServer as jest.Mock).mockResolvedValue({
      player: { userId: "u1" },
      tile: { tileId: "t1" },
      report: { kind: "explore" },
    });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/setup/explore",
          body: { count: 1 },
        }),
      ),
    );
    expect(status).toBe(200);
  });
});
