/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/attack/preview/route";
import { attackPreviewServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  attackPreviewServer: jest.fn(),
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockPreview = attackPreviewServer as jest.MockedFunction<typeof attackPreviewServer>;

const BODY = {
  sourceTileId: "0_0",
  targetTileId: "1_0",
  units: { ground: 5, siege: 0, air: 0 },
};

describe("POST /api/game/attack/preview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    mockPreview.mockResolvedValue({
      combat: { outcome: "win" },
      source: {},
      target: {},
      defender: {},
      effects: {},
    } as never);
  });

  it("returns 200 with combat preview", async () => {
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/game/attack/preview", body: BODY })),
    );
    expect(status).toBe(200);
    expect(body.combat).toBeDefined();
  });
});
