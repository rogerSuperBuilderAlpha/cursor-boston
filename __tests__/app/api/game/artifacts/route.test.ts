/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — GET /api/game/artifacts pagination + enrichment.
 */
import { GET } from "@/app/api/game/artifacts/route";
import { listArtifactsServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/data-server", () => ({
  listArtifactsServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockListArtifacts = listArtifactsServer as jest.MockedFunction<typeof listArtifactsServer>;

describe("GET /api/game/artifacts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockListArtifacts.mockResolvedValue({
      items: [
        {
          instanceId: "i1",
          definitionId: "__nonexistent_for_test__",
        } as never,
      ],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest({ path: "/api/game/artifacts" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid limit query", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await GET(
      makeAuthedRequest({
        path: "/api/game/artifacts",
        searchParams: { limit: "not-a-number" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockListArtifacts).not.toHaveBeenCalled();
  });

  it("returns 200 with artifacts list when repository responds", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const { status, body } = await readJson(await GET(makeAuthedRequest({ path: "/api/game/artifacts" })));
    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      artifacts: [{ instanceId: "i1", definition: null }],
      hasMore: false,
    });
    expect(mockListArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
    );
  });
});
