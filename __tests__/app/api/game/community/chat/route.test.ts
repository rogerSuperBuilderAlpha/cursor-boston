/**
 * @jest-environment node
 */
import { GET } from "@/app/api/game/community/chat/route";
import { listRecentCommunityMessages } from "@/lib/game/community";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ caste: "red", displayName: "U" }),
        }),
      })),
    })),
  })),
}));
jest.mock("@/lib/game/community", () => ({
  listRecentCommunityMessages: jest.fn().mockResolvedValue([]),
  COMMUNITY_PAGE_SIZE: 50,
  MAX_MESSAGE_LENGTH: 500,
}));

describe("GET /api/game/community/chat", () => {
  it("returns 200 with messages", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    const { status } = await readJson(
      await GET(makeAuthedRequest({ method: "GET", path: "/api/game/community/chat" })),
    );
    expect(status).toBe(200);
    expect(listRecentCommunityMessages).toHaveBeenCalled();
  });
});
