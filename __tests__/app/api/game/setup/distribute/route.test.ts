/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #4 — full coverage for setup/distribute route.
 */
import { POST } from "@/app/api/game/setup/distribute/route";
import { distributeTileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => {
  const actual = jest.requireActual("@/lib/game/data-server");
  return { ...actual, distributeTileServer: jest.fn() };
});

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockDistribute = distributeTileServer as jest.MockedFunction<typeof distributeTileServer>;

const VALID_BODY = { tileId: "t1", type: "food", count: 1 };
const SUCCESS = {
  player: { userId: "u1" },
  tile: { tileId: "t1" },
  report: { kind: "distribute" },
} as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockDistribute.mockResolvedValue(SUCCESS);
});

describe("POST /api/game/setup/distribute", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ method: "POST", path: "/api/game/setup/distribute", body: VALID_BODY }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for non-JSON body", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/setup/distribute",
        body: "not-json",
        headers: { Authorization: "Bearer test", "content-type": "text/plain" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields missing", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/setup/distribute",
        body: { tileId: "t1" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 on successful distribute", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/setup/distribute",
          body: VALID_BODY,
        }),
      ),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true });
    expect(mockDistribute).toHaveBeenCalledWith("u1", "t1", "food");
  });

  it("returns 500 via mapGameError when distributeTileServer throws", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    mockDistribute.mockRejectedValue(new Error("distribute failed"));
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/setup/distribute",
          body: VALID_BODY,
        }),
      ),
    );
    expect(status).toBe(500);
    expect(body.error.code).toBe("SERVER_ERROR");
  });
});
