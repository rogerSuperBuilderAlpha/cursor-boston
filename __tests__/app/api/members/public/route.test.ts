/**
 * @jest-environment node
 */

import { GET } from "@/app/api/members/public/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { computePublicMembersSnapshot } from "@/lib/members-public-snapshot";
import type { PublicMember } from "@/types/members";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/members-public-snapshot", () => ({
  MEMBERS_SNAPSHOT_CACHE_TTL_MS: 6 * 60 * 60 * 1000,
  computePublicMembersSnapshot: jest.fn(),
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockComputePublicMembersSnapshot = computePublicMembersSnapshot as jest.MockedFunction<
  typeof computePublicMembersSnapshot
>;

function buildMember(overrides: Partial<PublicMember> = {}): PublicMember {
  return {
    uid: "u1",
    memberType: "human",
    displayName: "Test User",
    visibility: { isPublic: true },
    ...overrides,
  } as PublicMember;
}

function mockDbWithSnapshot(snapshotData: Record<string, unknown> | null) {
  const set = jest.fn().mockResolvedValue(undefined);
  const get = jest.fn().mockResolvedValue({
    exists: snapshotData !== null,
    data: () => snapshotData,
  });
  const db = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({ get, set })),
    })),
  };
  mockGetAdminDb.mockReturnValue(db as never);
  return { db, get, set };
}

describe("GET /api/members/public", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns a fresh snapshot without rebuilding", async () => {
    const member = buildMember();
    const { set } = mockDbWithSnapshot({
      members: [member],
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.members).toEqual([member]);
    expect(mockComputePublicMembersSnapshot).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("rebuilds and stores the snapshot when the existing snapshot is empty", async () => {
    const member = buildMember({ uid: "u2", displayName: "Public Member" });
    const { set } = mockDbWithSnapshot({
      members: [],
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockComputePublicMembersSnapshot.mockResolvedValue([member]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.members).toEqual([member]);
    expect(mockComputePublicMembersSnapshot).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        members: [member],
        expiresAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
    );
  });

  it("falls back to stale snapshot data if the rebuild fails", async () => {
    const member = buildMember({ uid: "stale" });
    mockDbWithSnapshot({
      members: [member],
      expiresAt: new Date(Date.now() - 60_000),
    });
    mockComputePublicMembersSnapshot.mockRejectedValue(new Error("rebuild failed"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.members).toEqual([member]);
  });
});
