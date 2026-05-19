/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — game explore route validation + empty-body path.
 */
import { POST } from "@/app/api/game/explore/route";
import { frontierExploreServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  frontierExploreServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockFrontierExploreServer =
  frontierExploreServer as jest.MockedFunction<typeof frontierExploreServer>;

describe("POST /api/game/explore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockFrontierExploreServer.mockResolvedValue({
      player: { userId: "u1" },
      tile: { id: "new-tile" },
      report: { id: "rpt-1" },
      frontier: { remaining: 2 },
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(makeRequest({ method: "POST", path: "/api/game/explore" }));
    expect(res.status).toBe(401);
  });

  it("explores once when request has no body", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const req = makeAuthedRequest({ method: "POST", path: "/api/game/explore" });
    req.headers.delete("content-type");

    const { status, body } = await readJson(await POST(req));

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, frontier: { remaining: 2 } });
    expect(mockFrontierExploreServer).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid count in body", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const payload = JSON.stringify({ count: 0 });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/explore",
        body: payload,
        headers: { "content-length": String(payload.length) },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 when count is valid", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/explore",
          body: { count: 2 },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(mockFrontierExploreServer).toHaveBeenCalled();
  });
});
