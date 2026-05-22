/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment node
 */

import { GET } from "@/app/api/members/public/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { rebuildPublicMembersSnapshot } from "@/lib/members-public-snapshot";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/members-public-snapshot", () => ({
  MEMBERS_SNAPSHOT_CACHE_TTL_MS: 6 * 60 * 60 * 1000,
  rebuildPublicMembersSnapshot: jest.fn(),
}));

const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockRebuild = rebuildPublicMembersSnapshot as jest.MockedFunction<
  typeof rebuildPublicMembersSnapshot
>;

function setupSnapshot(opts: {
  exists?: boolean;
  data?: Record<string, unknown>;
  getThrows?: boolean;
}) {
  const getSpy = jest.fn();
  if (opts.getThrows) {
    getSpy.mockRejectedValue(new Error("get failed"));
  } else {
    getSpy.mockResolvedValue({
      exists: opts.exists ?? false,
      data: () => opts.data,
    });
  }

  mockDb.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({ get: getSpy })),
    })),
  } as never);

  return { getSpy };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/members/public", () => {
  it("returns empty members when admin db is unavailable", async () => {
    mockDb.mockReturnValue(null as never);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ members: [] });
  });

  it("returns the snapshot when it exists and is fresh", async () => {
    setupSnapshot({
      exists: true,
      data: {
        members: [{ uid: "u1", displayName: "Alice" }],
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const res = await GET();
    const body = await res.json();
    expect(body.members).toEqual([{ uid: "u1", displayName: "Alice" }]);
    expect(mockRebuild).not.toHaveBeenCalled();
  });

  it("returns stale snapshot data when the snapshot is expired", async () => {
    setupSnapshot({
      exists: true,
      data: {
        members: [{ uid: "stale" }],
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const res = await GET();
    await expect(res.json()).resolves.toEqual({ members: [{ uid: "stale" }] });
    expect(res.headers.get("X-Members-Snapshot-Stale")).toBe("true");
    expect(mockRebuild).not.toHaveBeenCalled();
  });

  it("returns empty snapshot data without rebuilding", async () => {
    setupSnapshot({
      exists: true,
      data: {
        members: [],
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const res = await GET();
    await expect(res.json()).resolves.toEqual({
      members: [],
    });
    expect(mockRebuild).not.toHaveBeenCalled();
  });

  it("returns empty members when the snapshot doc is missing", async () => {
    setupSnapshot({ exists: false });

    const res = await GET();
    await expect(res.json()).resolves.toEqual({ members: [] });
    expect(mockRebuild).not.toHaveBeenCalled();
  });

  it("returns empty members when snapshot load fails", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    setupSnapshot({ getThrows: true });

    const res = await GET();
    await expect(res.json()).resolves.toEqual({ members: [] });
    expect(mockRebuild).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
