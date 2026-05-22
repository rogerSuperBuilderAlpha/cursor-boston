/**
 * @jest-environment node
 */

import { GET } from "@/app/api/members/public/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { rebuildPublicMembersSnapshot } from "@/lib/members-public-snapshot";
import type { PublicMember } from "@/types/members";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/members-public-snapshot", () => ({
  MEMBERS_SNAPSHOT_CACHE_TTL_MS: 6 * 60 * 60 * 1000,
  rebuildPublicMembersSnapshot: jest.fn(),
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockRebuildPublicMembersSnapshot = rebuildPublicMembersSnapshot as jest.MockedFunction<
  typeof rebuildPublicMembersSnapshot
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

function mockDbWithSnapshotError(error: Error) {
  const get = jest.fn().mockRejectedValue(error);
  const db = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({ get })),
    })),
  };
  mockGetAdminDb.mockReturnValue(db as never);
  return { db, get };
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
    expect(mockRebuildPublicMembersSnapshot).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("returns an empty stored snapshot without rebuilding", async () => {
    const { set } = mockDbWithSnapshot({
      members: [],
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.members).toEqual([]);
    expect(mockRebuildPublicMembersSnapshot).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("serves stale snapshot data without rebuilding", async () => {
    const member = buildMember({ uid: "stale" });
    mockDbWithSnapshot({
      members: [member],
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.members).toEqual([member]);
    expect(res.headers.get("X-Members-Snapshot-Stale")).toBe("true");
    expect(mockRebuildPublicMembersSnapshot).not.toHaveBeenCalled();
  });

  it("returns an empty list when no snapshot exists", async () => {
    mockDbWithSnapshot(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.members).toEqual([]);
    expect(mockRebuildPublicMembersSnapshot).not.toHaveBeenCalled();
  });

  it("returns an empty list when the snapshot read fails", async () => {
    mockDbWithSnapshotError(new Error("snapshot read failed"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.members).toEqual([]);
    expect(mockRebuildPublicMembersSnapshot).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[api/members/public] Failed to load members snapshot",
      expect.any(Error)
    );
  });
});
