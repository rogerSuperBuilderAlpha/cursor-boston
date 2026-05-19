/**
 * @jest-environment node
 */
import { GET } from "@/app/api/game/world-meta/route";
import { getWorldMetaServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  getWorldMetaServer: jest.fn().mockResolvedValue({ seasonNumber: 1 }),
}));

describe("GET /api/game/world-meta", () => {
  it("returns 200 with world meta", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ method: "GET", path: "/api/game/world-meta" })),
    );
    expect(status).toBe(200);
    expect(body).toBeDefined();
    expect(getWorldMetaServer).toHaveBeenCalled();
  });
});
