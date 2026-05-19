/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/setup/caste/route";
import { chooseCasteServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  chooseCasteServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockChooseCaste = chooseCasteServer as jest.MockedFunction<typeof chooseCasteServer>;

describe("POST /api/game/setup/caste", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    expect((await POST(makeRequest({ method: "POST", path: "/api/game/setup/caste", body: { caste: "red" } }))).status).toBe(401);
  });

  it("returns 200 on success", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    mockChooseCaste.mockResolvedValue({ userId: "u1", caste: "red" } as never);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/game/setup/caste", body: { caste: "red" } })),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true });
  });
});
