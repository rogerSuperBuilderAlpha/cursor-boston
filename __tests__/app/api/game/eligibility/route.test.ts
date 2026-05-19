/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — game eligibility route guards.
 */
import { GET } from "@/app/api/game/eligibility/route";
import { getPlayerEligibilityServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  getPlayerEligibilityServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;

const mockGetPlayerEligibilityServer =
  getPlayerEligibilityServer as jest.MockedFunction<typeof getPlayerEligibilityServer>;

describe("GET /api/game/eligibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest({ path: "/api/game/eligibility" }));
    expect(res.status).toBe(401);
    expect(mockGetPlayerEligibilityServer).not.toHaveBeenCalled();
  });

  it("returns eligibility payload for authed user", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });
    mockGetPlayerEligibilityServer.mockResolvedValue({
      eligible: true,
      reason: null,
    } as never);

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/game/eligibility" })),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, eligible: true });
    expect(mockGetPlayerEligibilityServer).toHaveBeenCalledWith("u1");
  });
});
