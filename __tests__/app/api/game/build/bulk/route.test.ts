/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — POST /api/game/build/bulk validation + bulk path.
 */
import { POST } from "@/app/api/game/build/bulk/route";
import { bulkBuildUnitsServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  bulkBuildUnitsServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockBulkBuild = bulkBuildUnitsServer as jest.MockedFunction<typeof bulkBuildUnitsServer>;

const VALID_PLAN = [{ tileId: "t1", unitType: "ground" as const, cycles: 1 }];

describe("POST /api/game/build/bulk", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockBulkBuild.mockResolvedValue({
      player: { userId: "u1" },
      tiles: [],
      produced: 1,
      reports: [],
      stoppedEarly: undefined,
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/build/bulk",
        body: { plan: VALID_PLAN },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when plan total cycles exceeds cap", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/build/bulk",
        body: {
          plan: [
            { tileId: "a", unitType: "ground", cycles: 60 },
            { tileId: "b", unitType: "air", cycles: 50 },
          ],
        },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockBulkBuild).not.toHaveBeenCalled();
  });

  it("returns 200 when bulk build succeeds", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/build/bulk",
          body: { plan: VALID_PLAN },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, produced: 1 });
    expect(mockBulkBuild).toHaveBeenCalledWith("u1", VALID_PLAN);
  });
});
