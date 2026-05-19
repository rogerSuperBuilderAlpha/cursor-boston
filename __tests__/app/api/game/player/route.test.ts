/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — game player route GET/POST/PATCH guards.
 */
import { GET, PATCH, POST } from "@/app/api/game/player/route";
import {
  createPlayerWithSpawnServer,
  getOwnedMapTilesServer,
  getPlayerServer,
  setGeneralNameServer,
} from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  getPlayerServer: jest.fn(),
  getOwnedMapTilesServer: jest.fn(),
  createPlayerWithSpawnServer: jest.fn(),
  setGeneralNameServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetPlayer = getPlayerServer as jest.MockedFunction<typeof getPlayerServer>;
const mockGetTiles = getOwnedMapTilesServer as jest.MockedFunction<typeof getOwnedMapTilesServer>;
const mockCreatePlayer = createPlayerWithSpawnServer as jest.MockedFunction<
  typeof createPlayerWithSpawnServer
>;
const mockRename = setGeneralNameServer as jest.MockedFunction<typeof setGeneralNameServer>;

describe("GET /api/game/player", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest({ path: "/api/game/player" }));
    expect(res.status).toBe(401);
  });

  it("returns null player when profile does not exist", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User", isAdmin: false });
    mockGetPlayer.mockResolvedValue(null);

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/game/player" })),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, player: null, tiles: [], isAdmin: false });
  });

  it("returns player and owned tiles when profile exists", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User", isAdmin: true });
    mockGetPlayer.mockResolvedValue({ userId: "u1", displayName: "Ada" } as never);
    mockGetTiles.mockResolvedValue([{ id: "t1" }] as never);

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/game/player" })),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      player: { userId: "u1" },
      tiles: [{ id: "t1" }],
      isAdmin: true,
    });
  });
});

describe("POST /api/game/player", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/player",
        body: { displayName: "Ada" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when displayName is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeAuthedRequest({ method: "POST", path: "/api/game/player", body: {} }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 when player is created", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockCreatePlayer.mockResolvedValue({
      player: { userId: "u1", displayName: "Ada" },
      tileIds: ["t1", "t2"],
    } as never);

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/player",
          body: { displayName: "Ada" },
        }),
      ),
    );

    expect(status).toBe(201);
    expect(body).toMatchObject({
      success: true,
      player: { displayName: "Ada" },
      tileIds: ["t1", "t2"],
    });
  });
});

describe("PATCH /api/game/player", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await PATCH(
      makeRequest({
        method: "PATCH",
        path: "/api/game/player",
        body: { displayName: "New Name" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 when rename succeeds", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockRename.mockResolvedValue({ userId: "u1", displayName: "New Name" } as never);

    const { status, body } = await readJson(
      await PATCH(
        makeAuthedRequest({
          method: "PATCH",
          path: "/api/game/player",
          body: { displayName: "New Name" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      player: { displayName: "New Name" },
    });
  });
});
