/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #5 — full coverage for redistribute route.
 */
import { POST } from "@/app/api/game/redistribute/route";
import { redistributeUnitsServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => {
  const actual = jest.requireActual("@/lib/game/data-server");
  return { ...actual, redistributeUnitsServer: jest.fn() };
});

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockRedistribute = redistributeUnitsServer as jest.MockedFunction<typeof redistributeUnitsServer>;

const VALID = {
  sourceTileId: "a",
  destTileId: "b",
  units: { ground: 5, siege: 0, air: 0 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" } as never);
  mockRedistribute.mockResolvedValue({ source: {}, dest: {} } as never);
});

describe("POST /api/game/redistribute", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ method: "POST", path: "/api/game/redistribute", body: VALID }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for non-JSON body", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/redistribute",
        body: "not-json",
        headers: { Authorization: "Bearer test", "content-type": "text/plain" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when zod validation fails (missing fields)", async () => {
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/redistribute",
        body: { sourceTileId: "a" } as never,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative unit counts (zod min(0) fails)", async () => {
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/redistribute",
        body: { ...VALID, units: { ground: -1, siege: 0, air: 0 } },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when moving zero total units", async () => {
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/redistribute",
        body: { ...VALID, units: { ground: 0, siege: 0, air: 0 } },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 on success and forwards the parsed body", async () => {
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({ method: "POST", path: "/api/game/redistribute", body: VALID }),
      ),
    );
    expect(status).toBe(200);
    expect(mockRedistribute).toHaveBeenCalledWith({
      callerUserId: "u1",
      sourceTileId: "a",
      destTileId: "b",
      units: { ground: 5, siege: 0, air: 0 },
    });
  });

  it("returns 500 via mapGameError when redistributeUnitsServer throws", async () => {
    mockRedistribute.mockRejectedValue(new Error("redistribute failed"));
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({ method: "POST", path: "/api/game/redistribute", body: VALID }),
      ),
    );
    expect(status).toBe(500);
    expect(body.error.code).toBe("SERVER_ERROR");
  });
});
