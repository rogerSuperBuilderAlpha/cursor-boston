/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — tile inscription route.
 */
import { POST } from "@/app/api/game/tile/[tileId]/inscription/route";
import { setTileInscriptionServer } from "@/lib/game/data-server";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  setTileInscriptionServer: jest.fn(),
}));

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockSetInscription = setTileInscriptionServer as jest.MockedFunction<
  typeof setTileInscriptionServer
>;
const mockRateLimit = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

const params = Promise.resolve({ tileId: "tile-abc" });

describe("POST /api/game/tile/[tileId]/inscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockRateLimit.mockResolvedValue({
      success: true,
      remaining: 10,
      resetTime: Date.now() + 3_600_000,
    });
    mockSetInscription.mockResolvedValue({ id: "tile-abc", inscription: "Hi" } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/tile/tile-abc/inscription",
        body: { inscription: "Hi" },
      }),
      { params },
    );
    expect(res.status).toBe(401);
    expect(mockSetInscription).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });
    mockRateLimit.mockResolvedValueOnce({
      success: false,
      retryAfter: 90,
    });

    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/tile/tile-abc/inscription",
          body: { inscription: "Hi" },
        }),
        { params },
      ),
    );

    expect(status).toBe(429);
    expect(mockSetInscription).not.toHaveBeenCalled();
  });

  it("sets inscription and returns tile", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/tile/tile-abc/inscription",
          body: { inscription: "Marked" },
        }),
        { params },
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      tile: { id: "tile-abc", inscription: "Hi" },
    });
    expect(mockSetInscription).toHaveBeenCalledWith("u1", "tile-abc", "Marked");
  });
});
