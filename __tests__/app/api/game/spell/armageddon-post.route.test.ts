/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/spell/armageddon/route";
import { castArmageddonServer } from "@/lib/game/data-server";
import { resolveArmageddon } from "@/lib/game/armageddon-resolve";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  castArmageddonServer: jest.fn(),
  GamePlayerNotFoundError: class GamePlayerNotFoundError extends Error {},
  GameTileNotFoundError: class GameTileNotFoundError extends Error {},
}));

jest.mock("@/lib/game/armageddon-resolve", () => ({
  resolveArmageddon: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockCast = castArmageddonServer as jest.MockedFunction<typeof castArmageddonServer>;

describe("POST /api/game/spell/armageddon", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(makeRequest({ path: "/api/game/spell/armageddon", method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns cast result for authed user", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });
    mockCast.mockResolvedValue({
      success: true,
      successChance: 0.5,
      sealsBroken: 1,
      seasonNumber: 1,
      player: { userId: "u1" },
      shouldTriggerResolve: false,
    } as never);

    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ path: "/api/game/spell/armageddon", method: "POST" })),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, sealBroken: true });
    expect(mockCast).toHaveBeenCalledWith({ userId: "u1" });
    expect(resolveArmageddon).not.toHaveBeenCalled();
  });

  it("fires resolveArmageddon when seventh seal breaks", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u@test.com",
      name: "User",
    });
    mockCast.mockResolvedValue({
      success: true,
      shouldTriggerResolve: true,
      seasonNumber: 2,
      successChance: 1,
      sealsBroken: 7,
      player: { userId: "u1", displayName: "Gen", caste: "red" },
    } as never);

    await POST(makeAuthedRequest({ path: "/api/game/spell/armageddon", method: "POST" }));

    await new Promise((r) => setTimeout(r, 0));
    expect(resolveArmageddon).toHaveBeenCalled();
  });
});
