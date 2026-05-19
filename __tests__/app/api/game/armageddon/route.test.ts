/**
 * @jest-environment node
 */
import { GET } from "@/app/api/game/armageddon/route";
import { listArmageddonHistoryServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  listArmageddonHistoryServer: jest.fn().mockResolvedValue([]),
}));

describe("GET /api/game/armageddon", () => {
  it("returns 200 with history", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    const { status } = await readJson(
      await GET(makeAuthedRequest({ method: "GET", path: "/api/game/armageddon" })),
    );
    expect(status).toBe(200);
    expect(listArmageddonHistoryServer).toHaveBeenCalled();
  });
});
