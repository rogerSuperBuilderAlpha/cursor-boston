/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/flyover/route";
import { flyoverTileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  flyoverTileServer: jest.fn(),
}));

describe("POST /api/game/flyover", () => {
  it("returns 200 on flyover", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    (flyoverTileServer as jest.Mock).mockResolvedValue({ report: { kind: "flyover" } });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/flyover",
          body: {
            sourceTileId: "0_0",
            targetTileId: "1_0",
            units: { ground: 0, siege: 0, air: 5 },
          },
        }),
      ),
    );
    expect(status).toBe(200);
  });
});
