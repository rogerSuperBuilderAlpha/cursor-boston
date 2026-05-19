/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — game heroes list route.
 */
import { GET } from "@/app/api/game/heroes/route";
import { getHeroesListServer } from "@/lib/game/heroes-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/game/heroes-server", () => ({
  getHeroesListServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockGetHeroesList = getHeroesListServer as jest.MockedFunction<typeof getHeroesListServer>;

describe("GET /api/game/heroes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockGetAdminDb.mockReturnValue({} as never);
    mockGetHeroesList.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest({ path: "/api/game/heroes" }));
    expect(res.status).toBe(401);
    expect(mockGetHeroesList).not.toHaveBeenCalled();
  });

  it("returns 500 when Firestore is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });
    mockGetAdminDb.mockReturnValue(null);

    const { status } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/game/heroes" })),
    );
    expect(status).toBe(500);
    expect(mockGetHeroesList).not.toHaveBeenCalled();
  });

  it("returns paginated heroes for authed user", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });
    mockGetHeroesList.mockResolvedValue({
      items: [{ id: "h1" } as never],
      nextCursor: "cur-1",
      hasMore: true,
    });

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/game/heroes" })),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      heroes: [{ id: "h1" }],
      nextCursor: "cur-1",
      hasMore: true,
    });
    expect(mockGetHeroesList).toHaveBeenCalledWith(
      expect.objectContaining({ viewerId: "u1", scope: "all" }),
    );
  });
});
