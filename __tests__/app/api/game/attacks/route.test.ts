/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — GET /api/game/attacks pagination.
 */
import { GET } from "@/app/api/game/attacks/route";
import { getRecentAttacksServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  getRecentAttacksServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetRecentAttacks = getRecentAttacksServer as jest.MockedFunction<
  typeof getRecentAttacksServer
>;

describe("GET /api/game/attacks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockGetRecentAttacks.mockResolvedValue({
      items: [{ id: "atk-1" } as never],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest({ path: "/api/game/attacks" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid side query", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await GET(
      makeAuthedRequest({
        path: "/api/game/attacks",
        searchParams: { side: "bogus" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockGetRecentAttacks).not.toHaveBeenCalled();
  });

  it("returns 200 with attacks when query is valid", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status, body } = await readJson(
      await GET(
        makeAuthedRequest({
          path: "/api/game/attacks",
          searchParams: { side: "sent" },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, attacks: [{ id: "atk-1" }], hasMore: false });
    expect(mockGetRecentAttacks).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", side: "sent" }),
    );
  });
});
