/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/tiles/stance/route";
import { toggleDefensiveStanceServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  toggleDefensiveStanceServer: jest.fn(),
}));

describe("POST /api/game/tiles/stance", () => {
  it("returns 200 when toggling stance", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    (toggleDefensiveStanceServer as jest.Mock).mockResolvedValue({ tileId: "t1" });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/tiles/stance",
          body: { tileId: "t1", active: true },
        }),
      ),
    );
    expect(status).toBe(200);
  });
});
