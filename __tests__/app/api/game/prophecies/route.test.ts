/**
 * @jest-environment node
 */
import { GET } from "@/app/api/game/prophecies/route";
import { listPropheciesForSealServer } from "@/lib/game/prophecies";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/prophecies", () => ({
  listPropheciesForSealServer: jest.fn().mockResolvedValue([]),
  listPropheciesByAuthorServer: jest.fn().mockResolvedValue([]),
}));

describe("GET /api/game/prophecies", () => {
  it("returns 200 with prophecies list", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    const { status } = await readJson(
      await GET(
        makeAuthedRequest({
          method: "GET",
          path: "/api/game/prophecies",
          searchParams: { seal: "1" },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(listPropheciesForSealServer).toHaveBeenCalled();
  });
});
