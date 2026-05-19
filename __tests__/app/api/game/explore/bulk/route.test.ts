/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — POST /api/game/explore/bulk capped count path.
 */
import { POST } from "@/app/api/game/explore/bulk/route";
import { bulkFrontierExploreServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  bulkFrontierExploreServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockBulkExplore = bulkFrontierExploreServer as jest.MockedFunction<
  typeof bulkFrontierExploreServer
>;

describe("POST /api/game/explore/bulk", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockBulkExplore.mockResolvedValue({
      player: { userId: "u1" },
      tiles: [],
      reports: [],
      frontiers: [],
      stoppedEarly: undefined,
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/explore/bulk",
        body: { count: 1 },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when count exceeds per-call maximum", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/explore/bulk",
        body: { count: 51 },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockBulkExplore).not.toHaveBeenCalled();
  });

  it("returns 200 when bulk explore succeeds", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/explore/bulk",
          body: { count: 3 },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true });
    expect(mockBulkExplore).toHaveBeenCalledWith("u1", 3);
  });
});
