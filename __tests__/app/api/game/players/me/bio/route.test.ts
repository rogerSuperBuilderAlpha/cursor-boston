/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — player bio update route.
 */
import { POST } from "@/app/api/game/players/me/bio/route";
import { setPlayerBioServer } from "@/lib/game/data-server";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  setPlayerBioServer: jest.fn(),
}));

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockSetBio = setPlayerBioServer as jest.MockedFunction<typeof setPlayerBioServer>;
const mockRateLimit = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

describe("POST /api/game/players/me/bio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockRateLimit.mockResolvedValue({
      success: true,
      remaining: 4,
      resetTime: Date.now() + 3_600_000,
    });
    mockSetBio.mockResolvedValue({ userId: "u1", bio: "Hello" } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/players/me/bio",
        body: { bio: "Hello" },
      }),
    );
    expect(res.status).toBe(401);
    expect(mockSetBio).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });
    mockRateLimit.mockResolvedValueOnce({
      success: false,
      retryAfter: 600,
    });

    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/players/me/bio",
          body: { bio: "Too many edits" },
        }),
      ),
    );

    expect(status).toBe(429);
    expect(mockSetBio).not.toHaveBeenCalled();
  });

  it("returns player after bio update", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/players/me/bio",
          body: { bio: "New bio" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, player: { userId: "u1", bio: "Hello" } });
    expect(mockSetBio).toHaveBeenCalledWith("u1", "New bio");
  });
});
