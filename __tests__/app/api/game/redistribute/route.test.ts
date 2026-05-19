/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/redistribute/route";
import { redistributeUnitsServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  redistributeUnitsServer: jest.fn(),
}));

describe("POST /api/game/redistribute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    (redistributeUnitsServer as jest.Mock).mockResolvedValue({ source: {}, dest: {} });
  });

  it("returns 400 when moving zero units", async () => {
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/redistribute",
        body: { sourceTileId: "a", destTileId: "b", units: { ground: 0, siege: 0, air: 0 } },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 on success", async () => {
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/redistribute",
          body: { sourceTileId: "a", destTileId: "b", units: { ground: 5, siege: 0, air: 0 } },
        }),
      ),
    );
    expect(status).toBe(200);
  });
});
