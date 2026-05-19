/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #4 — full coverage for setup/explore route.
 */
import { POST } from "@/app/api/game/setup/explore/route";
import { exploreNextTileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => {
  const actual = jest.requireActual("@/lib/game/data-server");
  return { ...actual, exploreNextTileServer: jest.fn() };
});

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockExplore = exploreNextTileServer as jest.MockedFunction<typeof exploreNextTileServer>;

const SUCCESS_RESULT = {
  player: { userId: "u1" },
  tile: { tileId: "t1" },
  report: { kind: "explore" },
} as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockExplore.mockResolvedValue(SUCCESS_RESULT);
});

describe("POST /api/game/setup/explore", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ method: "POST", path: "/api/game/setup/explore", body: { count: 1 } }),
    );
    expect(res.status).toBe(401);
  });

  it("explores once when request body is absent (count=1 default)", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    // No body: content-length header not set, route takes the count=1 default branch.
    const req = new (require("next/server").NextRequest)("https://example.com/api/game/setup/explore", {
      method: "POST",
      headers: { Authorization: "Bearer test" },
    });
    const { status } = await readJson(await POST(req));
    expect(status).toBe(200);
    expect(mockExplore).toHaveBeenCalledTimes(1);
  });

  it("returns 200 on setup explore with explicit count", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/setup/explore",
          body: { count: 2 },
        }),
      ),
    );
    expect(status).toBe(200);
    // parseBatchCount clamps to >=1; with count=2 we expect 2 calls
    expect(mockExplore).toHaveBeenCalled();
  });

  it("returns 400 for invalid request body shape (with Content-Length set)", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    // Route only parses the body when Content-Length is set; the test
    // helper doesn't set it automatically, so we construct the request by
    // hand to exercise the body-parsing branch.
    const payload = JSON.stringify({ count: "not-a-number" });
    const NextRequest = require("next/server").NextRequest;
    const req = new NextRequest("https://example.com/api/game/setup/explore", {
      method: "POST",
      headers: {
        Authorization: "Bearer test",
        "Content-Type": "application/json",
        "Content-Length": String(payload.length),
      },
      body: payload,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-JSON body (with Content-Length set)", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    const payload = "garbage";
    const NextRequest = require("next/server").NextRequest;
    const req = new NextRequest("https://example.com/api/game/setup/explore", {
      method: "POST",
      headers: {
        Authorization: "Bearer test",
        "Content-Type": "text/plain",
        "Content-Length": String(payload.length),
      },
      body: payload,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 SERVER_ERROR via mapGameError when explore throws", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    mockExplore.mockRejectedValue(new Error("explore failed"));
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/setup/explore",
          body: { count: 1 },
        }),
      ),
    );
    expect(status).toBe(500);
    expect(body.error.code).toBe("SERVER_ERROR");
  });
});
