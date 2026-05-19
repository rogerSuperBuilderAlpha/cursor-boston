/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/last-stand/route";
import { declareLastStandServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  declareLastStandServer: jest.fn(),
}));

describe("POST /api/game/last-stand", () => {
  it("returns 200 on last stand", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    (declareLastStandServer as jest.Mock).mockResolvedValue({ tileId: "t1" });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/last-stand",
          body: { tileId: "t1" },
        }),
      ),
    );
    expect(status).toBe(200);
  });
});
