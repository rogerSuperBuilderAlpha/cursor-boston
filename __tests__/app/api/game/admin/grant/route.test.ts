/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/admin/grant/route";
import { adminGrantTurnsServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  adminGrantTurnsServer: jest.fn(),
}));

describe("POST /api/game/admin/grant", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVerifiedUser as jest.Mock).mockResolvedValue({
      uid: "admin",
      email: "a@test.com",
      name: "A",
      isAdmin: false,
    });
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
