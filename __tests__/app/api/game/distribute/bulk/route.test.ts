/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — POST /api/game/distribute/bulk tile cap + success.
 */
import { POST } from "@/app/api/game/distribute/bulk/route";
import { bulkDistributeTilesServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  bulkDistributeTilesServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockBulkDistribute = bulkDistributeTilesServer as jest.MockedFunction<
  typeof bulkDistributeTilesServer
>;

describe("POST /api/game/distribute/bulk", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockBulkDistribute.mockResolvedValue({
      player: { userId: "u1" },
      tiles: [],
      reports: [],
      stoppedEarly: undefined,
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/distribute/bulk",
        body: { tileIds: ["a"], type: "food" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when tileIds list exceeds cap", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const tileIds = Array.from({ length: 101 }, (_, i) => `t${i}`);
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/distribute/bulk",
        body: { tileIds, type: "magic" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockBulkDistribute).not.toHaveBeenCalled();
  });

  it("returns 200 when bulk distribute succeeds", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const tileIds = ["x1", "x2"];
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/distribute/bulk",
          body: { tileIds, type: "unassigned" },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true });
    expect(mockBulkDistribute).toHaveBeenCalledWith("u1", tileIds, "unassigned");
  });
});
