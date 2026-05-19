/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/caste/change/route";
import { changeCasteServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  changeCasteServer: jest.fn(),
}));

describe("POST /api/game/caste/change", () => {
  it("returns 200 when caste changes", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    (changeCasteServer as jest.Mock).mockResolvedValue({ userId: "u1", caste: "blue" });
    const { status } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/game/caste/change", body: { caste: "blue" } })),
    );
    expect(status).toBe(200);
  });
});
