/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/special-units/unsummon/route";
import { unsummonSpecialUnitServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  unsummonSpecialUnitServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockUnsummon = unsummonSpecialUnitServer as jest.MockedFunction<
  typeof unsummonSpecialUnitServer
>;

describe("POST /api/game/special-units/unsummon", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        path: "/api/game/special-units/unsummon",
        method: "POST",
        body: { instanceId: "s1" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("unsummons unit for authed user", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });
    mockUnsummon.mockResolvedValue({ player: { userId: "u1" } } as never);

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          path: "/api/game/special-units/unsummon",
          method: "POST",
          body: { instanceId: "s1" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true });
    expect(mockUnsummon).toHaveBeenCalledWith({
      userId: "u1",
      instanceId: "s1",
    });
  });
});
