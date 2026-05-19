/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — hero pep-talk route.
 */
import { POST } from "@/app/api/game/heroes/pep-talk/route";
import { pepTalkHeroServer } from "@/lib/game/data-server";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  pepTalkHeroServer: jest.fn(),
}));

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockPepTalk = pepTalkHeroServer as jest.MockedFunction<typeof pepTalkHeroServer>;
const mockRateLimit = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

describe("POST /api/game/heroes/pep-talk", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockRateLimit.mockResolvedValue({
      success: true,
      remaining: 2,
      resetTime: Date.now() + 3_600_000,
    });
    mockPepTalk.mockResolvedValue({ tileId: "t1", hero: { id: "h1" } } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/heroes/pep-talk",
        body: { tileId: "t1" },
      }),
    );
    expect(res.status).toBe(401);
    expect(mockPepTalk).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });
    mockRateLimit.mockResolvedValueOnce({
      success: false,
      retryAfter: 120,
    });

    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/heroes/pep-talk",
          body: { tileId: "t1" },
        }),
      ),
    );

    expect(status).toBe(429);
    expect(mockPepTalk).not.toHaveBeenCalled();
  });

  it("returns tile payload on success", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/heroes/pep-talk",
          body: { tileId: "t1" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, tile: { tileId: "t1" } });
    expect(mockPepTalk).toHaveBeenCalledWith({ callerUserId: "u1", tileId: "t1" });
  });
});
