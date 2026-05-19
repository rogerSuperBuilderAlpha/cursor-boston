/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — POST /api/game/build auth + validation + batch path.
 */
import { POST } from "@/app/api/game/build/route";
import { buildUnitsServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  buildUnitsServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockBuildUnitsServer = buildUnitsServer as jest.MockedFunction<typeof buildUnitsServer>;

describe("POST /api/game/build", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockBuildUnitsServer.mockResolvedValue({
      player: { userId: "u1" },
      tile: { id: "t1" },
      produced: 2,
      report: { kind: "build" },
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/build",
        body: { tileId: "t1", unitType: "ground" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid unitType", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/build",
        body: { tileId: "t1", unitType: "invalid" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("runs one build cycle when count is omitted", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/build",
          body: { tileId: "t1", unitType: "ground" },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, produced: 2 });
    expect(mockBuildUnitsServer).toHaveBeenCalledTimes(1);
    expect(mockBuildUnitsServer).toHaveBeenCalledWith("u1", "t1", "ground");
  });
});
