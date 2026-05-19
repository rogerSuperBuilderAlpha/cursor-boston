/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/explore/far/route";
import { farExpeditionExploreServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  farExpeditionExploreServer: jest.fn(),
}));

describe("POST /api/game/explore/far", () => {
  it("returns 200 on far expedition", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    (farExpeditionExploreServer as jest.Mock).mockResolvedValue({
      player: { userId: "u1" },
      report: { kind: "explore" },
    });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/explore/far",
          body: { count: 1 },
        }),
      ),
    );
    expect(status).toBe(200);
  });
});
