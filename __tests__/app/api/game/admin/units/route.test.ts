/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — admin units bootstrap route.
 */
import { POST } from "@/app/api/game/admin/units/route";
import { adminGrantUnitsServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  adminGrantUnitsServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGrantUnits = adminGrantUnitsServer as jest.MockedFunction<typeof adminGrantUnitsServer>;

describe("POST /api/game/admin/units", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
      isAdmin: false,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/admin/units",
        body: { tileId: "t1", unitType: "ground", count: 5 },
      }),
    );
    expect(res.status).toBe(401);
    expect(mockGrantUnits).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin", async () => {
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/admin/units",
        body: { tileId: "t1", unitType: "ground", count: 5 },
      }),
    );
    expect(res.status).toBe(403);
    expect(mockGrantUnits).not.toHaveBeenCalled();
  });

  it("returns 400 when tileId is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin",
      email: "a@test.com",
      name: "A",
      isAdmin: true,
    });

    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/admin/units",
          body: { unitType: "ground", count: 5 },
        }),
      ),
    );

    expect(status).toBe(400);
    expect(mockGrantUnits).not.toHaveBeenCalled();
  });

  it("grants units for admin", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin",
      email: "a@test.com",
      name: "A",
      isAdmin: true,
    });
    mockGrantUnits.mockResolvedValue({
      player: { userId: "target" } as never,
      tile: { id: "t1" } as never,
    });

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/admin/units",
          body: { ownerId: "target", tileId: "t1", unitType: "ground", count: 3 },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      player: { userId: "target" },
      tile: { id: "t1" },
    });
    expect(mockGrantUnits).toHaveBeenCalledWith({
      ownerId: "target",
      tileId: "t1",
      unitType: "ground",
      count: 3,
    });
  });
});
