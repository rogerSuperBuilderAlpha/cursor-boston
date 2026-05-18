/**
 * @jest-environment node
 */
import type { Firestore, Transaction } from "firebase-admin/firestore";
import {
  MAX_PROPHECY_LENGTH,
  ProphecyEmptyError,
  ProphecyForbiddenError,
  ProphecyInvalidSealError,
  ProphecyNotFoundError,
  ProphecySealAlreadyBrokenError,
  ProphecyTooLongError,
  createProphecyServer,
  deleteProphecyServer,
  listPropheciesByAuthorServer,
  listPropheciesForSealServer,
  resolveProphesiesForSealInTx,
} from "@/lib/game/prophecies";
import type { Prophecy } from "@/lib/game/types";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));
jest.mock("@/lib/sanitize", () => ({
  sanitizeText: (s: string) => s.trim(),
}));
jest.mock("@/lib/game/community", () => ({
  logCommunityEventInTx: jest.fn(),
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { increment: (n: number) => ({ __increment: n }) },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import { logCommunityEventInTx } from "@/lib/game/community";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockLog = logCommunityEventInTx as jest.MockedFunction<typeof logCommunityEventInTx>;

function fakeDb(opts: {
  worldMeta?: { exists: boolean; sealsBroken?: number };
  propheciesDocs?: Prophecy[];
  prophecyDoc?: { exists: boolean; data?: Prophecy };
  setSink?: { id?: string; data?: unknown };
  updateSink?: { data?: unknown };
}): Firestore {
  return {
    collection: (_name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          if (id === "singleton") {
            return {
              exists: !!opts.worldMeta?.exists,
              data: () => ({ sealsBroken: opts.worldMeta?.sealsBroken ?? 0 }),
            };
          }
          return {
            exists: !!opts.prophecyDoc?.exists,
            data: () => opts.prophecyDoc?.data,
          };
        },
        set: async (data: unknown) => {
          if (opts.setSink) {
            opts.setSink.id = id;
            opts.setSink.data = data;
          }
        },
        update: async (data: unknown) => {
          if (opts.updateSink) opts.updateSink.data = data;
        },
      }),
      where: () => ({
        where: () => ({ get: async () => ({ docs: [] }) }),
        orderBy: () => ({
          get: async () => ({
            docs: (opts.propheciesDocs ?? []).map((p) => ({
              data: () => p,
              ref: { __ref: p.id },
            })),
          }),
        }),
        get: async () => ({
          docs: (opts.propheciesDocs ?? []).map((p) => ({
            data: () => p,
            ref: { __ref: p.id },
          })),
        }),
      }),
    }),
  } as unknown as Firestore;
}

describe("game/prophecies", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
    mockLog.mockReset();
  });

  describe("error classes", () => {
    it("all 6 error classes have stable names", () => {
      expect(new ProphecyEmptyError().name).toBe("ProphecyEmptyError");
      expect(new ProphecyTooLongError().name).toBe("ProphecyTooLongError");
      expect(new ProphecyInvalidSealError().name).toBe("ProphecyInvalidSealError");
      expect(new ProphecySealAlreadyBrokenError().name).toBe("ProphecySealAlreadyBrokenError");
      expect(new ProphecyForbiddenError().name).toBe("ProphecyForbiddenError");
      expect(new ProphecyNotFoundError().name).toBe("ProphecyNotFoundError");
    });
    it("TooLongError carries the length cap in the message", () => {
      expect(new ProphecyTooLongError().message).toContain(String(MAX_PROPHECY_LENGTH));
    });
  });

  describe("createProphecyServer", () => {
    const author = { userId: "u1", displayName: "Alice", caste: "red" as const };

    it.each([
      ["non-integer (0)", 0],
      ["non-integer (8)", 8],
      ["non-integer (-1)", -1],
    ])("rejects invalid seal number: %s", async (_n, sealNumber) => {
      mockGetAdminDb.mockReturnValue(fakeDb({}) as unknown as ReturnType<typeof getAdminDb>);
      await expect(
        createProphecyServer({ author, targetSealNumber: sealNumber, rawPrediction: "x" })
      ).rejects.toThrow(ProphecyInvalidSealError);
    });

    it("rejects empty prediction (after sanitize)", async () => {
      mockGetAdminDb.mockReturnValue(fakeDb({}) as unknown as ReturnType<typeof getAdminDb>);
      await expect(
        createProphecyServer({ author, targetSealNumber: 1, rawPrediction: "  " })
      ).rejects.toThrow(ProphecyEmptyError);
    });

    it("rejects too-long prediction", async () => {
      mockGetAdminDb.mockReturnValue(fakeDb({}) as unknown as ReturnType<typeof getAdminDb>);
      const long = "x".repeat(MAX_PROPHECY_LENGTH + 1);
      await expect(
        createProphecyServer({ author, targetSealNumber: 1, rawPrediction: long })
      ).rejects.toThrow(ProphecyTooLongError);
    });

    it("rejects when the target seal has already broken", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({ worldMeta: { exists: true, sealsBroken: 3 } }) as unknown as ReturnType<typeof getAdminDb>
      );
      await expect(
        createProphecyServer({ author, targetSealNumber: 2, rawPrediction: "the end is nigh" })
      ).rejects.toThrow(ProphecySealAlreadyBrokenError);
    });

    it("persists a valid prophecy", async () => {
      const setSink: { id?: string; data?: unknown } = {};
      mockGetAdminDb.mockReturnValue(
        fakeDb({ worldMeta: { exists: true, sealsBroken: 0 }, setSink }) as unknown as ReturnType<typeof getAdminDb>
      );
      const out = await createProphecyServer({
        author,
        targetSealNumber: 3,
        rawPrediction: "the third seal breaks tonight",
      });
      expect(out.authorId).toBe("u1");
      expect(out.targetSealNumber).toBe(3);
      expect(out.prediction).toBe("the third seal breaks tonight");
      expect(setSink.data).toBeDefined();
    });

    it("treats a missing world-meta doc as sealsBroken = 0", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({ worldMeta: { exists: false } }) as unknown as ReturnType<typeof getAdminDb>
      );
      // Seal 1 should be valid because no seal has broken yet.
      const out = await createProphecyServer({
        author,
        targetSealNumber: 1,
        rawPrediction: "first seal soon",
      });
      expect(out.targetSealNumber).toBe(1);
    });
  });

  describe("listPropheciesForSealServer", () => {
    it("returns prophecies for a seal, filtering deleted", async () => {
      const prophecies: Prophecy[] = [
        { id: "p1", targetSealNumber: 1 } as unknown as Prophecy,
        { id: "p2", targetSealNumber: 1, deletedAt: new Date() } as unknown as Prophecy,
        { id: "p3", targetSealNumber: 1 } as unknown as Prophecy,
      ];
      mockGetAdminDb.mockReturnValue(
        fakeDb({ propheciesDocs: prophecies }) as unknown as ReturnType<typeof getAdminDb>
      );
      const out = await listPropheciesForSealServer(1);
      expect(out.map((p) => p.id)).toEqual(["p1", "p3"]);
    });
  });

  describe("listPropheciesByAuthorServer", () => {
    it("returns prophecies for an author, filtering deleted", async () => {
      const prophecies: Prophecy[] = [
        { id: "p1", authorId: "u1" } as unknown as Prophecy,
        { id: "p2", authorId: "u1", deletedAt: new Date() } as unknown as Prophecy,
      ];
      mockGetAdminDb.mockReturnValue(
        fakeDb({ propheciesDocs: prophecies }) as unknown as ReturnType<typeof getAdminDb>
      );
      const out = await listPropheciesByAuthorServer("u1");
      expect(out.map((p) => p.id)).toEqual(["p1"]);
    });
  });

  describe("deleteProphecyServer", () => {
    it("throws ProphecyNotFoundError when missing", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({ prophecyDoc: { exists: false } }) as unknown as ReturnType<typeof getAdminDb>
      );
      await expect(
        deleteProphecyServer({ prophecyId: "p", callerUserId: "u", callerIsAdmin: false })
      ).rejects.toThrow(ProphecyNotFoundError);
    });

    it("throws ProphecyForbiddenError for non-author non-admin", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({
          prophecyDoc: { exists: true, data: { authorId: "other" } as Prophecy },
        }) as unknown as ReturnType<typeof getAdminDb>
      );
      await expect(
        deleteProphecyServer({ prophecyId: "p", callerUserId: "me", callerIsAdmin: false })
      ).rejects.toThrow(ProphecyForbiddenError);
    });

    it("author delete sets deletedByAdmin=false", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({
          prophecyDoc: { exists: true, data: { id: "p", authorId: "me" } as Prophecy },
        }) as unknown as ReturnType<typeof getAdminDb>
      );
      const out = await deleteProphecyServer({
        prophecyId: "p",
        callerUserId: "me",
        callerIsAdmin: false,
      });
      expect(out.deletedByAdmin).toBe(false);
    });

    it("admin delete (non-author) sets deletedByAdmin=true", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({
          prophecyDoc: { exists: true, data: { id: "p", authorId: "other" } as Prophecy },
        }) as unknown as ReturnType<typeof getAdminDb>
      );
      const out = await deleteProphecyServer({
        prophecyId: "p",
        callerUserId: "admin",
        callerIsAdmin: true,
      });
      expect(out.deletedByAdmin).toBe(true);
    });
  });

  describe("resolveProphesiesForSealInTx", () => {
    const brokenBy = {
      userId: "u-breaker",
      displayName: "Breaker",
      caste: "black" as const,
    };

    it("no-ops when no prophecies target the broken seal", async () => {
      const db = fakeDb({ propheciesDocs: [] });
      const updateMock = jest.fn();
      const tx = { update: updateMock } as unknown as Transaction;
      await resolveProphesiesForSealInTx({
        tx,
        db,
        brokenSealNumber: 1,
        brokenBy,
        now: new Date(),
      });
      expect(updateMock).not.toHaveBeenCalled();
    });

    it("resolves each live prophecy and emits prophecy_fulfilled events", async () => {
      const now = new Date();
      const prophecies: Prophecy[] = [
        {
          id: "p1",
          authorId: "u1",
          authorDisplayName: "Alice",
          authorCaste: "red",
          targetSealNumber: 1,
          prediction: "the bell tolls",
        } as unknown as Prophecy,
      ];
      const db = fakeDb({ propheciesDocs: prophecies });
      const updateMock = jest.fn();
      const tx = { update: updateMock } as unknown as Transaction;
      await resolveProphesiesForSealInTx({
        tx,
        db,
        brokenSealNumber: 1,
        brokenBy,
        now,
      });
      // Two updates: prophecy doc resolve, player doc bumps.
      expect(updateMock).toHaveBeenCalledTimes(2);
      const prophecyUpdate = updateMock.mock.calls[0][1];
      expect(prophecyUpdate.resolvedAt).toBe(now);
      expect(prophecyUpdate.fulfilledBy).toEqual(brokenBy);
      expect(mockLog).toHaveBeenCalledTimes(1);
    });

    it("skips already-resolved and deleted prophecies", async () => {
      const prophecies: Prophecy[] = [
        { id: "deleted", deletedAt: new Date() } as unknown as Prophecy,
        { id: "resolved", resolvedAt: new Date() } as unknown as Prophecy,
      ];
      const db = fakeDb({ propheciesDocs: prophecies });
      const updateMock = jest.fn();
      const tx = { update: updateMock } as unknown as Transaction;
      await resolveProphesiesForSealInTx({
        tx,
        db,
        brokenSealNumber: 1,
        brokenBy,
        now: new Date(),
      });
      expect(updateMock).not.toHaveBeenCalled();
      expect(mockLog).not.toHaveBeenCalled();
    });
  });
});
