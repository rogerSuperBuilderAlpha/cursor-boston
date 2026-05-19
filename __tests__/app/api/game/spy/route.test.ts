/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — POST /api/game/spy intel spell.
 */
import { POST } from "@/app/api/game/spy/route";
import { castIntelSpellServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  castIntelSpellServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockCastIntel = castIntelSpellServer as jest.MockedFunction<typeof castIntelSpellServer>;

describe("POST /api/game/spy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockCastIntel.mockResolvedValue({
      player: { userId: "u1" },
      report: { kind: "spy" },
      intelReport: { foo: 1 },
      detected: false,
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/spy",
        body: { spellId: "s1", targetTileId: "t1" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/spy",
        body: { spellId: "", targetTileId: "t1" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockCastIntel).not.toHaveBeenCalled();
  });

  it("returns 200 when intel spell succeeds", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/spy",
          body: { spellId: "intel-1", targetTileId: "enemy-tile" },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, detected: false });
    expect(mockCastIntel).toHaveBeenCalledWith("u1", "intel-1", "enemy-tile");
  });
});
