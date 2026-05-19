/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #5 — full coverage for siege route.
 */
import { POST } from "@/app/api/game/siege/route";
import { siegeTileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => {
  const actual = jest.requireActual("@/lib/game/data-server");
  return { ...actual, siegeTileServer: jest.fn() };
});

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockSiege = siegeTileServer as jest.MockedFunction<typeof siegeTileServer>;

const VALID = { sourceTileId: "0_0", targetTileId: "1_0" };
const SUCCESS = {
  player: { userId: "u1" },
  report: { kind: "siege" },
  siegeTotalMagnitude: 1,
} as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" } as never);
  mockSiege.mockResolvedValue(SUCCESS);
});

describe("POST /api/game/siege", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ method: "POST", path: "/api/game/siege", body: VALID }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for non-JSON body", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/siege",
        body: "not-json",
        headers: { Authorization: "Bearer test", "content-type": "text/plain" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when zod validation fails", async () => {
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/siege",
        body: { sourceTileId: "0_0" } as never,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 on successful siege", async () => {
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({ method: "POST", path: "/api/game/siege", body: VALID }),
      ),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, siegeTotalMagnitude: 1 });
    expect(mockSiege).toHaveBeenCalledWith({
      attackerId: "u1",
      sourceTileId: "0_0",
      targetTileId: "1_0",
    });
  });

  it("returns 500 via mapGameError when siegeTileServer throws", async () => {
    mockSiege.mockRejectedValue(new Error("siege failed"));
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({ method: "POST", path: "/api/game/siege", body: VALID }),
      ),
    );
    expect(status).toBe(500);
    expect(body.error.code).toBe("SERVER_ERROR");
  });
});
