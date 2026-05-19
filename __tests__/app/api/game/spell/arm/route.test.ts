/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — POST /api/game/spell/arm single-tile batch.
 */
import { POST } from "@/app/api/game/spell/arm/route";
import { armDefenseSpellServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => {
  // Keep the error classes that mapGameError uses for instanceof checks;
  // only override the function we need to spy on.
  const actual = jest.requireActual("@/lib/game/data-server");
  return {
    ...actual,
    armDefenseSpellServer: jest.fn(),
  };
});

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockArmDefense = armDefenseSpellServer as jest.MockedFunction<typeof armDefenseSpellServer>;

describe("POST /api/game/spell/arm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockArmDefense.mockResolvedValue({
      player: { userId: "u1" },
      tile: { id: "t1" },
      report: { kind: "arm" },
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/spell/arm",
        body: { spellId: "shield", tileId: "t1" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when neither tileId nor tileIds provided", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/spell/arm",
        body: { spellId: "shield" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockArmDefense).not.toHaveBeenCalled();
  });

  it("returns 200 when single-tile arm succeeds", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/spell/arm",
          body: { spellId: "ward", tileId: "mine-1", count: 1 },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(mockArmDefense).toHaveBeenCalledWith("u1", "mine-1", "ward");
  });

  it("returns 400 when bulk tileIds exceeds the cap", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const tileIds = Array.from({ length: 201 }, (_, i) => `tile-${i}`);
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/spell/arm",
          body: { spellId: "shield", tileIds },
        }),
      ),
    );
    expect(status).toBe(400);
    expect(body.error.message).toContain("Too many tileIds");
  });

  it("returns 200 with armed/failed summary for bulk arm (all succeed)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockArmDefense
      .mockResolvedValueOnce({
        player: { userId: "u1" },
        tile: { id: "t1" },
        report: { kind: "arm", tileId: "t1" },
      } as never)
      .mockResolvedValueOnce({
        player: { userId: "u1" },
        tile: { id: "t2" },
        report: { kind: "arm", tileId: "t2" },
      } as never);

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/spell/arm",
          body: { spellId: "ward", tileIds: ["t1", "t2"] },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(body.armed).toBe(2);
    expect(body.failed).toEqual([]);
    expect(body.reports).toHaveLength(2);
    expect(mockArmDefense).toHaveBeenCalledTimes(2);
  });

  it("collects per-tile failures and continues the bulk batch (partial success)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockArmDefense
      .mockResolvedValueOnce({
        player: { userId: "u1" },
        tile: { id: "t1" },
        report: { kind: "arm", tileId: "t1" },
      } as never)
      .mockRejectedValueOnce(new Error("Insufficient mana"))
      .mockRejectedValueOnce("non-error-throw");

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/spell/arm",
          body: { spellId: "ward", tileIds: ["t1", "t2", "t3"] },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(body.armed).toBe(1);
    expect(body.failed).toEqual([
      { tileId: "t2", reason: "Insufficient mana" },
      { tileId: "t3", reason: "non-error-throw" },
    ]);
    expect(body.reports).toHaveLength(1);
  });

  it("maps to game error when every tile in the bulk batch fails", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockArmDefense.mockRejectedValue(new Error("Tile not owned"));
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/spell/arm",
          body: { spellId: "ward", tileIds: ["t1", "t2"] },
        }),
      ),
    );
    // mapGameError returns a generic 500 SERVER_ERROR for unknown Error
    // instances (it doesn't surface arbitrary error messages — that's a
    // security design choice). The point of this test is to exercise the
    // "all failed → mapGameError fallback" branch in the bulk path.
    expect(status).toBe(500);
    expect(body.error.code).toBe("SERVER_ERROR");
  });

  it("translates thrown game errors via mapGameError in the single-tile path", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockArmDefense.mockRejectedValue(new Error("Mana too low"));
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/spell/arm",
          body: { spellId: "ward", tileId: "mine-1" },
        }),
      ),
    );
    expect(status).toBe(500);
    expect(body.error.code).toBe("SERVER_ERROR");
  });

  it("returns 400 with zod-issue message for invalid body", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/spell/arm",
          // spellId is required by the contract
          body: { tileId: "t1" },
        }),
      ),
    );
    expect(status).toBe(400);
    expect(typeof body.error.message).toBe("string");
  });

  it("returns 400 for invalid JSON request body", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/spell/arm",
        body: "not-json",
        headers: { "content-type": "text/plain" },
      }),
    );
    expect(res.status).toBe(400);
  });
});
