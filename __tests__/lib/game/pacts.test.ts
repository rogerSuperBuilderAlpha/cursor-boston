/**
 * @jest-environment node
 */
import type { Firestore, Transaction } from "firebase-admin/firestore";
import {
  MAX_PACT_STATEMENT_LENGTH,
  PactEmptyError,
  PactForbiddenError,
  PactNotFoundError,
  PactSelfTargetError,
  PactTargetNotFoundError,
  PactTooLongError,
  createPactServer,
  deletePactServer,
  findActivePactsBetween,
  listPactsForPlayerServer,
  markPactsBrokenInTx,
} from "@/lib/game/pacts";
import type { Pact } from "@/lib/game/types";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));
jest.mock("@/lib/sanitize", () => ({
  sanitizeText: (s: string) => s.trim(),
}));
jest.mock("@/lib/game/community", () => ({
  logCommunityEventInTx: jest.fn(),
}));

import { getAdminDb } from "@/lib/firebase-admin";
import { logCommunityEventInTx } from "@/lib/game/community";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockLogCommunityEvent = logCommunityEventInTx as jest.MockedFunction<typeof logCommunityEventInTx>;

type CollectionStub = {
  doc: (id: string) => DocStub;
  where: (...args: unknown[]) => QueryStub;
};
type DocStub = {
  get: () => Promise<{ exists: boolean; data?: () => unknown; ref?: unknown }>;
  set: (data: unknown) => Promise<void>;
  update: (data: unknown) => Promise<void>;
};
type QueryStub = {
  where: (...args: unknown[]) => QueryStub;
  get: () => Promise<{ docs: Array<{ data: () => unknown; ref: unknown }>; empty: boolean }>;
};

function fakeDb(opts: {
  targetDoc?: { exists: boolean; data?: unknown };
  pactDocs?: Pact[];
  pactDoc?: { exists: boolean; data?: Pact };
  updateSink?: { data?: unknown };
  setSink?: { id?: string; data?: unknown };
}): Firestore {
  const mkDoc = (id: string): DocStub => ({
    get: async () => {
      const td = opts.targetDoc;
      const pd = opts.pactDoc;
      if (id === "player-target") {
        return { exists: !!td?.exists, data: () => td?.data };
      }
      return {
        exists: !!pd?.exists,
        data: () => pd?.data,
        ref: { __ref: id },
      };
    },
    set: async (data: unknown) => {
      if (opts.setSink) {
        opts.setSink.id = id;
        opts.setSink.data = data;
      }
    },
    update: async (data: unknown) => {
      if (opts.updateSink) {
        opts.updateSink.data = data;
      }
    },
  });
  const mkQuery = (): QueryStub => ({
    where: () => mkQuery(),
    get: async () => ({
      docs: (opts.pactDocs ?? []).map((p) => ({
        data: () => p,
        ref: { __ref: p.id },
      })),
      empty: (opts.pactDocs ?? []).length === 0,
    }),
  });
  const collection = (_name: string): CollectionStub => ({
    doc: mkDoc,
    where: () => mkQuery(),
  });
  return { collection } as unknown as Firestore;
}

describe("game/pacts", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
    mockLogCommunityEvent.mockReset();
  });

  describe("error classes", () => {
    it("PactEmptyError, PactTooLongError, PactSelfTargetError, PactTargetNotFoundError, PactForbiddenError, PactNotFoundError all have stable names", () => {
      expect(new PactEmptyError().name).toBe("PactEmptyError");
      expect(new PactTooLongError().name).toBe("PactTooLongError");
      expect(new PactSelfTargetError().name).toBe("PactSelfTargetError");
      expect(new PactTargetNotFoundError().name).toBe("PactTargetNotFoundError");
      expect(new PactForbiddenError().name).toBe("PactForbiddenError");
      expect(new PactNotFoundError().name).toBe("PactNotFoundError");
    });

    it("PactTooLongError message mentions the length cap", () => {
      expect(new PactTooLongError().message).toContain(String(MAX_PACT_STATEMENT_LENGTH));
    });
  });

  describe("createPactServer", () => {
    const author = { userId: "u-author", displayName: "Alice", caste: "red" as const };

    it("rejects self-target", async () => {
      mockGetAdminDb.mockReturnValue(fakeDb({}) as unknown as ReturnType<typeof getAdminDb>);
      await expect(
        createPactServer({ author, targetId: author.userId, rawStatement: "hi" })
      ).rejects.toThrow(PactSelfTargetError);
    });

    it("rejects empty statement (after sanitize)", async () => {
      mockGetAdminDb.mockReturnValue(fakeDb({}) as unknown as ReturnType<typeof getAdminDb>);
      await expect(
        createPactServer({ author, targetId: "u-other", rawStatement: "   " })
      ).rejects.toThrow(PactEmptyError);
    });

    it("rejects too-long statement", async () => {
      mockGetAdminDb.mockReturnValue(fakeDb({}) as unknown as ReturnType<typeof getAdminDb>);
      const long = "x".repeat(MAX_PACT_STATEMENT_LENGTH + 1);
      await expect(
        createPactServer({ author, targetId: "u-other", rawStatement: long })
      ).rejects.toThrow(PactTooLongError);
    });

    it("rejects when target doesn't exist", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({ targetDoc: { exists: false } }) as unknown as ReturnType<typeof getAdminDb>
      );
      await expect(
        createPactServer({ author, targetId: "player-target", rawStatement: "hi" })
      ).rejects.toThrow(PactTargetNotFoundError);
    });

    it("creates a pact and returns the full record", async () => {
      const setSink: { id?: string; data?: unknown } = {};
      mockGetAdminDb.mockReturnValue(
        fakeDb({
          targetDoc: {
            exists: true,
            data: { displayName: "Bob", caste: "blue" },
          },
          setSink,
        }) as unknown as ReturnType<typeof getAdminDb>
      );
      const pact = await createPactServer({
        author,
        targetId: "player-target",
        rawStatement: "no attack for 7 days",
      });
      expect(pact.authorId).toBe("u-author");
      expect(pact.targetDisplayName).toBe("Bob");
      expect(pact.statement).toBe("no attack for 7 days");
      expect(pact.expiresAt instanceof Date).toBe(true);
    });

    it("falls back to 'Unknown general' when target has no displayName", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({ targetDoc: { exists: true, data: {} } }) as unknown as ReturnType<typeof getAdminDb>
      );
      const pact = await createPactServer({
        author,
        targetId: "player-target",
        rawStatement: "hi",
      });
      expect(pact.targetDisplayName).toBe("Unknown general");
      expect(pact.targetCaste).toBeNull();
    });
  });

  describe("listPactsForPlayerServer", () => {
    it("returns deduplicated pacts sorted by expiresAt desc, skipping deleted", async () => {
      const now = new Date();
      const pacts: Pact[] = [
        {
          id: "p1",
          expiresAt: new Date(now.getTime() + 100_000),
        } as unknown as Pact,
        {
          id: "p2",
          expiresAt: new Date(now.getTime() + 50_000),
        } as unknown as Pact,
        {
          id: "p1", // dup
          expiresAt: new Date(now.getTime() + 100_000),
        } as unknown as Pact,
        {
          id: "p3",
          deletedAt: now, // skipped
          expiresAt: new Date(now.getTime() + 200_000),
        } as unknown as Pact,
      ];
      mockGetAdminDb.mockReturnValue(
        fakeDb({ pactDocs: pacts }) as unknown as ReturnType<typeof getAdminDb>
      );
      const out = await listPactsForPlayerServer("u1");
      expect(out.map((p) => p.id)).toEqual(["p1", "p2"]);
    });

    it("handles timestamp-shaped expiresAt fields (seconds)", async () => {
      const now = Date.now() / 1000;
      const pacts: Pact[] = [
        {
          id: "tsa",
          expiresAt: { seconds: now + 200 } as unknown as Date,
        } as unknown as Pact,
        {
          id: "tsb",
          expiresAt: { seconds: now + 100 } as unknown as Date,
        } as unknown as Pact,
      ];
      mockGetAdminDb.mockReturnValue(
        fakeDb({ pactDocs: pacts }) as unknown as ReturnType<typeof getAdminDb>
      );
      const out = await listPactsForPlayerServer("u1");
      expect(out.map((p) => p.id)).toEqual(["tsa", "tsb"]);
    });
  });

  describe("deletePactServer", () => {
    it("throws PactNotFoundError when pact doesn't exist", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({ pactDoc: { exists: false } }) as unknown as ReturnType<typeof getAdminDb>
      );
      await expect(
        deletePactServer({ pactId: "p", callerUserId: "u", callerIsAdmin: false })
      ).rejects.toThrow(PactNotFoundError);
    });

    it("throws PactForbiddenError when non-author non-admin caller tries to delete", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({
          pactDoc: { exists: true, data: { authorId: "other" } as Pact },
        }) as unknown as ReturnType<typeof getAdminDb>
      );
      await expect(
        deletePactServer({ pactId: "p", callerUserId: "me", callerIsAdmin: false })
      ).rejects.toThrow(PactForbiddenError);
    });

    it("allows author to delete (sets deletedByAdmin=false)", async () => {
      const updateSink: { data?: unknown } = {};
      mockGetAdminDb.mockReturnValue(
        fakeDb({
          pactDoc: { exists: true, data: { id: "p", authorId: "me" } as Pact },
          updateSink,
        }) as unknown as ReturnType<typeof getAdminDb>
      );
      const out = await deletePactServer({
        pactId: "p",
        callerUserId: "me",
        callerIsAdmin: false,
      });
      expect(out.deletedAt).toBeInstanceOf(Date);
      expect(out.deletedByAdmin).toBe(false);
      expect((updateSink.data as { deletedByAdmin: boolean }).deletedByAdmin).toBe(false);
    });

    it("allows admin to delete (sets deletedByAdmin=true when not author)", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({
          pactDoc: { exists: true, data: { id: "p", authorId: "other" } as Pact },
        }) as unknown as ReturnType<typeof getAdminDb>
      );
      const out = await deletePactServer({
        pactId: "p",
        callerUserId: "admin",
        callerIsAdmin: true,
      });
      expect(out.deletedByAdmin).toBe(true);
    });
  });

  describe("findActivePactsBetween", () => {
    const now = new Date();

    it("returns [] when no pacts exist", async () => {
      const db = fakeDb({ pactDocs: [] });
      expect(
        await findActivePactsBetween({ db, attackerId: "a", defenderId: "d", now })
      ).toEqual([]);
    });

    it("filters out deleted, broken, and expired pacts", async () => {
      const pacts: Pact[] = [
        {
          id: "active",
          expiresAt: new Date(now.getTime() + 100_000),
        } as unknown as Pact,
        {
          id: "deleted",
          deletedAt: now,
          expiresAt: new Date(now.getTime() + 100_000),
        } as unknown as Pact,
        {
          id: "broken",
          brokenAt: now,
          expiresAt: new Date(now.getTime() + 100_000),
        } as unknown as Pact,
        {
          id: "expired",
          expiresAt: new Date(now.getTime() - 1),
        } as unknown as Pact,
      ];
      const db = fakeDb({ pactDocs: pacts });
      const out = await findActivePactsBetween({
        db,
        attackerId: "a",
        defenderId: "d",
        now,
      });
      expect(out.map((p) => p.id)).toEqual(["active"]);
    });
  });

  describe("markPactsBrokenInTx", () => {
    it("no-ops when there are no matching pacts", async () => {
      const db = fakeDb({ pactDocs: [] });
      const tx = { update: jest.fn() } as unknown as Transaction;
      await markPactsBrokenInTx({
        tx,
        db,
        attackerId: "a",
        attackerDisplayName: "A",
        attackerCaste: "red",
        defenderId: "d",
        defenderDisplayName: "D",
        now: new Date(),
      });
      expect(tx.update).not.toHaveBeenCalled();
      expect(mockLogCommunityEvent).not.toHaveBeenCalled();
    });

    it("updates brokenAt + logs a pact_broken event for each live pact", async () => {
      const now = new Date();
      const pacts: Pact[] = [
        {
          id: "p1",
          statement: "no attack",
          expiresAt: new Date(now.getTime() + 100_000),
        } as unknown as Pact,
      ];
      const db = fakeDb({ pactDocs: pacts });
      const updateMock = jest.fn();
      const tx = { update: updateMock } as unknown as Transaction;
      await markPactsBrokenInTx({
        tx,
        db,
        attackerId: "a",
        attackerDisplayName: "A",
        attackerCaste: "red",
        defenderId: "d",
        defenderDisplayName: "D",
        now,
      });
      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock.mock.calls[0][1]).toMatchObject({ brokenAt: now });
      expect(mockLogCommunityEvent).toHaveBeenCalledTimes(1);
    });

    it("skips deleted/broken/expired pacts", async () => {
      const now = new Date();
      const pacts: Pact[] = [
        { id: "exp", expiresAt: new Date(now.getTime() - 1) } as unknown as Pact,
        { id: "del", deletedAt: now, expiresAt: new Date(now.getTime() + 100) } as unknown as Pact,
        { id: "brk", brokenAt: now, expiresAt: new Date(now.getTime() + 100) } as unknown as Pact,
      ];
      const db = fakeDb({ pactDocs: pacts });
      const updateMock = jest.fn();
      const tx = { update: updateMock } as unknown as Transaction;
      await markPactsBrokenInTx({
        tx,
        db,
        attackerId: "a",
        attackerDisplayName: "A",
        attackerCaste: null,
        defenderId: "d",
        defenderDisplayName: "D",
        now,
      });
      expect(updateMock).not.toHaveBeenCalled();
    });
  });
});
