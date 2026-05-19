/**
 * @jest-environment node
 */
import { GET } from "@/app/api/game/map/me/route";
import { getMyMapServer } from "@/lib/game/data-server";
import { readWorldSnapshotServer } from "@/lib/game/world-snapshot";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/world-snapshot", () => ({
  readWorldSnapshotServer: jest.fn().mockResolvedValue(null),
  deriveMyMapFromSnapshot: jest.fn(),
}));
jest.mock("@/lib/game/data-server", () => ({
  getMyMapServer: jest.fn().mockResolvedValue({ tiles: [], owners: [] }),
}));

describe("GET /api/game/map/me", () => {
  it("returns 200 with tiles", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    const { status } = await readJson(
      await GET(makeAuthedRequest({ method: "GET", path: "/api/game/map/me" })),
    );
    expect(status).toBe(200);
    expect(getMyMapServer).toHaveBeenCalledWith("u1");
    expect(readWorldSnapshotServer).toHaveBeenCalled();
  });
});
