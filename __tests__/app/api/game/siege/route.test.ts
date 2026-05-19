/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/siege/route";
import { siegeTileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  siegeTileServer: jest.fn(),
}));

describe("POST /api/game/siege", () => {
  it("returns 200 on siege", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    (siegeTileServer as jest.Mock).mockResolvedValue({
      player: { userId: "u1" },
      report: { kind: "siege" },
      siegeTotalMagnitude: 1,
    });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/siege",
          body: { sourceTileId: "0_0", targetTileId: "1_0" },
        }),
      ),
    );
    expect(status).toBe(200);
  });
});
