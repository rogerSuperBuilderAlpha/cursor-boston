/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/setup/distribute/route";
import { distributeTileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  distributeTileServer: jest.fn(),
}));

describe("POST /api/game/setup/distribute", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/setup/distribute",
        body: { tileId: "t1", type: "food", count: 1 },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 on success", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    (distributeTileServer as jest.Mock).mockResolvedValue({
      player: { userId: "u1" },
      tile: { tileId: "t1" },
      report: { kind: "distribute" },
    });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/setup/distribute",
          body: { tileId: "t1", type: "food", count: 1 },
        }),
      ),
    );
    expect(status).toBe(200);
  });
});
