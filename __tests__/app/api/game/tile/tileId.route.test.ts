/**
 * @jest-environment node
 */
import { GET } from "@/app/api/game/tile/[tileId]/route";
import { getTileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  getTileServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetTileServer = getTileServer as jest.MockedFunction<typeof getTileServer>;

describe("GET /api/game/tile/[tileId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(
      makeRequest({ path: "/api/game/tile/0_0" }),
      { params: Promise.resolve({ tileId: "0_0" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns tile for authed user", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });
    mockGetTileServer.mockResolvedValue({
      tileId: "0_0",
      ownerId: "u1",
    } as never);

    const { status, body } = await readJson(
      await GET(
        makeAuthedRequest({ path: "/api/game/tile/0_0" }),
        { params: Promise.resolve({ tileId: "0_0" }) },
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, tile: { tileId: "0_0" } });
    expect(mockGetTileServer).toHaveBeenCalledWith("0_0");
  });

  it("returns 404 when tile missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });
    mockGetTileServer.mockResolvedValue(null);

    const res = await GET(
      makeAuthedRequest({ path: "/api/game/tile/missing" }),
      { params: Promise.resolve({ tileId: "missing" }) },
    );
    expect(res.status).toBe(404);
  });
});
