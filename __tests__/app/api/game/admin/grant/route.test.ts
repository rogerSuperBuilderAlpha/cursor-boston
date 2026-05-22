/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/admin/grant/route";
import { adminGrantTurnsServer } from "@/lib/game/data-server";
import {
  getVerifiedUser,
  isCurrentIdTokenRevoked,
} from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
  isCurrentIdTokenRevoked: jest.fn(async () => false),
}));
jest.mock("@/lib/game/data-server", () => ({
  adminGrantTurnsServer: jest.fn(),
}));

describe("POST /api/game/admin/grant", () => {
  const mockIsRevoked = isCurrentIdTokenRevoked as jest.MockedFunction<
    typeof isCurrentIdTokenRevoked
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsRevoked.mockResolvedValue(false);
    (getVerifiedUser as jest.Mock).mockResolvedValue({
      uid: "admin",
      email: "a@test.com",
      name: "A",
      isAdmin: false,
    });
  });

  it("returns 401 when the admin token has been revoked", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValueOnce({
      uid: "admin",
      email: "a@test.com",
      name: "A",
      isAdmin: true,
    });
    mockIsRevoked.mockResolvedValueOnce(true);

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/admin/grant",
          body: { weekStartIso: "2026-05-18T05:30:00.000Z" },
        }),
      ),
    );

    expect(status).toBe(401);
    expect(body.error).toMatchObject({
      code: "UNAUTHORIZED",
      message: "Session revoked. Please sign in again.",
    });
    expect(adminGrantTurnsServer).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin", async () => {
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/admin/grant",
        body: { weekStartIso: "2026-05-18T05:30:00.000Z" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 for admin grant", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({
      uid: "admin",
      email: "a@test.com",
      name: "A",
      isAdmin: true,
    });
    (adminGrantTurnsServer as jest.Mock).mockResolvedValue({ userId: "admin", turnsRemaining: 50 });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/admin/grant",
          body: { weekStartIso: "2026-05-18T05:30:00.000Z" },
        }),
      ),
    );
    expect(status).toBe(200);
  });
});
