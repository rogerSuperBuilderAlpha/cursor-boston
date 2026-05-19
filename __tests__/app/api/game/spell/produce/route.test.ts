/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/spell/produce/route";
import { castProductionSpellServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  castProductionSpellServer: jest.fn(),
}));

describe("POST /api/game/spell/produce", () => {
  it("returns 200 on production cast", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    (castProductionSpellServer as jest.Mock).mockResolvedValue({
      player: { userId: "u1" },
      report: { kind: "produce" },
    });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/spell/produce",
          body: { spellId: "red-production-forge-boon" },
        }),
      ),
    );
    expect(status).toBe(200);
  });
});
