/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/heroes/meditate/route";
import { meditateHeroServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  meditateHeroServer: jest.fn(),
}));

describe("POST /api/game/heroes/meditate", () => {
  it("returns 200 on meditate", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    (meditateHeroServer as jest.Mock).mockResolvedValue({ tileId: "t1", hero: { id: "h1" } });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/heroes/meditate",
          body: { tileId: "t1" },
        }),
      ),
    );
    expect(status).toBe(200);
  });
});
