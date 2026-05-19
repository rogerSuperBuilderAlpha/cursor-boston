/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — GET /api/game/community/feed.
 */
import { GET } from "@/app/api/game/community/feed/route";
import { listRecentCommunityEvents } from "@/lib/game/community";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/community", () => ({
  ...jest.requireActual("@/lib/game/community"),
  listRecentCommunityEvents: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockListEvents = listRecentCommunityEvents as jest.MockedFunction<
  typeof listRecentCommunityEvents
>;

describe("GET /api/game/community/feed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockListEvents.mockResolvedValue([{ id: "e1", kind: "chat" } as never]);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest({ path: "/api/game/community/feed" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 with events and cache headers", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await GET(makeAuthedRequest({ path: "/api/game/community/feed" }));
    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, events: [{ id: "e1" }] });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=30");
    expect(mockListEvents).toHaveBeenCalled();
  });
});
