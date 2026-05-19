/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — PUT /api/game/reactions rate limit + toggle.
 */
import { PUT } from "@/app/api/game/reactions/route";
import { toggleReactionServer } from "@/lib/game/reactions";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));

jest.mock("@/lib/game/reactions", () => ({
  ...jest.requireActual("@/lib/game/reactions"),
  toggleReactionServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockRateLimit = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;
const mockToggle = toggleReactionServer as jest.MockedFunction<typeof toggleReactionServer>;

const BODY = { scope: "chat" as const, docId: "msg-1", emoji: "⚔️" as const };

describe("PUT /api/game/reactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockRateLimit.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 0 } as never);
    mockToggle.mockResolvedValue({
      active: true,
      reactions: { "⚔️": 1 },
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await PUT(
      makeRequest({
        method: "PUT",
        path: "/api/game/reactions",
        body: BODY,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit blocks the user", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockRateLimit.mockResolvedValue({ success: false, retryAfter: 42 } as never);
    const { status, body } = await readJson(
      await PUT(
        makeAuthedRequest({
          method: "PUT",
          path: "/api/game/reactions",
          body: BODY,
        }),
      ),
    );
    expect(status).toBe(429);
    expect(String((body as { error?: { message?: string } }).error?.message)).toContain("42");
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it("returns 400 when emoji is invalid", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await PUT(
      makeAuthedRequest({
        method: "PUT",
        path: "/api/game/reactions",
        body: { ...BODY, emoji: "👍" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it("returns 200 when toggle succeeds", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status, body } = await readJson(
      await PUT(
        makeAuthedRequest({
          method: "PUT",
          path: "/api/game/reactions",
          body: BODY,
        }),
      ),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, active: true });
    expect(mockToggle).toHaveBeenCalledWith({
      userId: "u1",
      scope: "chat",
      docId: "msg-1",
      emoji: "⚔️",
      heroId: undefined,
    });
  });
});
