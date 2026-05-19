/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #1 — full coverage of the DELETE handler
 * on /api/game/prophecies/[prophecyId] (0% → ~100%).
 */
import { DELETE } from "@/app/api/game/prophecies/[prophecyId]/route";
import {
  ProphecyForbiddenError,
  ProphecyNotFoundError,
  deleteProphecyServer,
} from "@/lib/game/prophecies";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/prophecies", () => {
  const actual = jest.requireActual("@/lib/game/prophecies");
  return {
    ...actual,
    deleteProphecyServer: jest.fn(),
  };
});

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockDelete = deleteProphecyServer as jest.MockedFunction<typeof deleteProphecyServer>;

const USER = { uid: "u1", email: "u@test.com", name: "U", isAdmin: false } as never;
const ADMIN = { uid: "admin1", email: "a@test.com", name: "A", isAdmin: true } as never;

function withParams(prophecyId: string) {
  return { params: Promise.resolve({ prophecyId }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDelete.mockResolvedValue({ id: "p-1", deletedAt: "2026-05-19" } as never);
});

describe("DELETE /api/game/prophecies/[prophecyId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await DELETE(
      makeAuthedRequest({ method: "DELETE", path: "/api/game/prophecies/p-1" }),
      withParams("p-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when prophecyId is empty", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    const res = await DELETE(
      makeAuthedRequest({ method: "DELETE", path: "/api/game/prophecies/" }),
      withParams(""),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 with the deleted prophecy on success (author)", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    const { status, body } = await readJson(
      await DELETE(
        makeAuthedRequest({ method: "DELETE", path: "/api/game/prophecies/p-1" }),
        withParams("p-1"),
      ),
    );
    expect(status).toBe(200);
    expect(body.prophecy).toMatchObject({ id: "p-1" });
    expect(mockDelete).toHaveBeenCalledWith({
      prophecyId: "p-1",
      callerUserId: "u1",
      callerIsAdmin: false,
    });
  });

  it("passes callerIsAdmin=true for admin user", async () => {
    mockGetVerifiedUser.mockResolvedValue(ADMIN);
    await DELETE(
      makeAuthedRequest({ method: "DELETE", path: "/api/game/prophecies/p-1" }),
      withParams("p-1"),
    );
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ callerIsAdmin: true }),
    );
  });

  it("translates ProphecyNotFoundError to 404", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockDelete.mockRejectedValue(new ProphecyNotFoundError());
    const { status, body } = await readJson(
      await DELETE(
        makeAuthedRequest({ method: "DELETE", path: "/api/game/prophecies/p-1" }),
        withParams("p-1"),
      ),
    );
    expect(status).toBe(404);
    expect(typeof body.error.message).toBe("string");
  });

  it("translates ProphecyForbiddenError to 403", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockDelete.mockRejectedValue(new ProphecyForbiddenError());
    const { status, body } = await readJson(
      await DELETE(
        makeAuthedRequest({ method: "DELETE", path: "/api/game/prophecies/p-1" }),
        withParams("p-1"),
      ),
    );
    expect(status).toBe(403);
    expect(typeof body.error.message).toBe("string");
  });

  it("returns 500 for untyped Error", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockDelete.mockRejectedValue(new Error("kaboom"));
    const { status, body } = await readJson(
      await DELETE(
        makeAuthedRequest({ method: "DELETE", path: "/api/game/prophecies/p-1" }),
        withParams("p-1"),
      ),
    );
    expect(status).toBe(500);
    expect(body.error.message).toBe("kaboom");
  });

  it("returns 500 'Server error' for non-Error throws", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockDelete.mockImplementation(() => {
      throw "string-thrown";
    });
    const { status, body } = await readJson(
      await DELETE(
        makeAuthedRequest({ method: "DELETE", path: "/api/game/prophecies/p-1" }),
        withParams("p-1"),
      ),
    );
    expect(status).toBe(500);
    expect(body.error.message).toBe("Server error");
  });
});
