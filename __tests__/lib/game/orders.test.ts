/**
 * @jest-environment node
 */
import type { Firestore, Transaction } from "firebase-admin/firestore";
import {
  QueuedOrderForbiddenError,
  QueuedOrderInvalidParamsError,
  QueuedOrderNotFoundError,
  QueuedOrderQueueFullError,
  cancelOrderServer,
  enqueueOrderServer,
  listOrdersForPlayerServer,
  markOrderResultInTx,
  readQueuedOrdersForPlayer,
} from "@/lib/game/orders";
import type {
  QueuedOrder,
  QueuedOrderParams,
} from "@/lib/game/types";
import { QUEUED_ORDERS_MAX_PER_PLAYER } from "@/lib/game/types";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));
import { getAdminDb } from "@/lib/firebase-admin";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

type QueuedDoc = { data: () => QueuedOrder };

function fakeDb(opts: {
  queueDocs?: QueuedOrder[];
  setSink?: { id?: string; data?: unknown };
  cancelInitial?: QueuedOrder | null;
  cancelExists?: boolean;
  txUpdateSink?: { ref?: unknown; updates?: Partial<QueuedOrder> };
}): Firestore {
  return {
    collection: (_name: string) => ({
      doc: (id: string) => ({
        set: async (data: unknown) => {
          if (opts.setSink) {
            opts.setSink.id = id;
            opts.setSink.data = data;
          }
          return undefined;
        },
      }),
      where: (..._args: unknown[]) => ({
        where: (..._args2: unknown[]) => ({
          get: async () => ({
            size: opts.queueDocs?.length ?? 0,
            docs: (opts.queueDocs ?? []).map<QueuedDoc>((q) => ({ data: () => q })),
          }),
        }),
        get: async () => ({
          docs: (opts.queueDocs ?? []).map<QueuedDoc>((q) => ({ data: () => q })),
        }),
      }),
    }),
    runTransaction: async (cb: (tx: Transaction) => Promise<QueuedOrder>) => {
      const tx = {
        get: async (_ref: unknown) => ({
          exists: opts.cancelExists ?? !!opts.cancelInitial,
          data: () => opts.cancelInitial,
        }),
        update: (ref: unknown, updates: Partial<QueuedOrder>) => {
          if (opts.txUpdateSink) {
            opts.txUpdateSink.ref = ref;
            opts.txUpdateSink.updates = updates;
          }
        },
      } as unknown as Transaction;
      return cb(tx);
    },
  } as unknown as Firestore;
}

describe("game/orders", () => {
  beforeEach(() => mockGetAdminDb.mockReset());

  describe("error classes", () => {
    it("QueuedOrderQueueFullError carries cap in the message", () => {
      const err = new QueuedOrderQueueFullError(5);
      expect(err.message).toContain("5");
      expect(err.cap).toBe(5);
      expect(err.name).toBe("QueuedOrderQueueFullError");
    });
    it("QueuedOrderNotFoundError + QueuedOrderForbiddenError have stable names", () => {
      expect(new QueuedOrderNotFoundError().name).toBe("QueuedOrderNotFoundError");
      expect(new QueuedOrderForbiddenError().name).toBe("QueuedOrderForbiddenError");
    });
    it("QueuedOrderInvalidParamsError preserves the message", () => {
      expect(new QueuedOrderInvalidParamsError("bad").message).toBe("bad");
    });
  });

  describe("enqueueOrderServer — param validation", () => {
    it("rejects recruit_on_tile with missing tileId", async () => {
      mockGetAdminDb.mockReturnValue(fakeDb({}) as unknown as ReturnType<typeof getAdminDb>);
      const params = {
        kind: "recruit_on_tile",
        tileId: "",
        unitType: "ground",
      } as unknown as QueuedOrderParams;
      await expect(
        enqueueOrderServer({ playerId: "p", kind: "recruit_on_tile", params })
      ).rejects.toThrow(QueuedOrderInvalidParamsError);
    });

    it("rejects recruit_on_tile with invalid unitType", async () => {
      mockGetAdminDb.mockReturnValue(fakeDb({}) as unknown as ReturnType<typeof getAdminDb>);
      const params = {
        kind: "recruit_on_tile",
        tileId: "t",
        unitType: "horse",
      } as unknown as QueuedOrderParams;
      await expect(
        enqueueOrderServer({ playerId: "p", kind: "recruit_on_tile", params })
      ).rejects.toThrow(QueuedOrderInvalidParamsError);
    });

    it("rejects attack_adjacent with missing tile ids", async () => {
      mockGetAdminDb.mockReturnValue(fakeDb({}) as unknown as ReturnType<typeof getAdminDb>);
      const params = {
        kind: "attack_adjacent",
        sourceTileId: "",
        targetTileId: "",
        units: { ground: 1, siege: 0, air: 0 },
      } as unknown as QueuedOrderParams;
      await expect(
        enqueueOrderServer({ playerId: "p", kind: "attack_adjacent", params })
      ).rejects.toThrow(QueuedOrderInvalidParamsError);
    });

    it("rejects attack_adjacent with negative units", async () => {
      mockGetAdminDb.mockReturnValue(fakeDb({}) as unknown as ReturnType<typeof getAdminDb>);
      const params = {
        kind: "attack_adjacent",
        sourceTileId: "s",
        targetTileId: "t",
        units: { ground: -1, siege: 0, air: 0 },
      } as unknown as QueuedOrderParams;
      await expect(
        enqueueOrderServer({ playerId: "p", kind: "attack_adjacent", params })
      ).rejects.toThrow(QueuedOrderInvalidParamsError);
    });

    it("rejects attack_adjacent sending 0 total units", async () => {
      mockGetAdminDb.mockReturnValue(fakeDb({}) as unknown as ReturnType<typeof getAdminDb>);
      const params = {
        kind: "attack_adjacent",
        sourceTileId: "s",
        targetTileId: "t",
        units: { ground: 0, siege: 0, air: 0 },
      } as unknown as QueuedOrderParams;
      await expect(
        enqueueOrderServer({ playerId: "p", kind: "attack_adjacent", params })
      ).rejects.toThrow(QueuedOrderInvalidParamsError);
    });

    it("rejects cast_spell_on_tile with missing tileId or spellId", async () => {
      mockGetAdminDb.mockReturnValue(fakeDb({}) as unknown as ReturnType<typeof getAdminDb>);
      await expect(
        enqueueOrderServer({
          playerId: "p",
          kind: "cast_spell_on_tile",
          params: { kind: "cast_spell_on_tile", tileId: "t", spellId: "" } as QueuedOrderParams,
        })
      ).rejects.toThrow(QueuedOrderInvalidParamsError);
    });

    it("rejects when params.kind doesn't match the requested kind", async () => {
      mockGetAdminDb.mockReturnValue(fakeDb({}) as unknown as ReturnType<typeof getAdminDb>);
      await expect(
        enqueueOrderServer({
          playerId: "p",
          kind: "recruit_on_tile",
          params: {
            kind: "cast_spell_on_tile",
            tileId: "t",
            spellId: "s",
          } as QueuedOrderParams,
        })
      ).rejects.toThrow(QueuedOrderInvalidParamsError);
    });
  });

  describe("enqueueOrderServer — queue cap + happy path", () => {
    it("throws QueuedOrderQueueFullError at cap", async () => {
      const full: QueuedOrder[] = Array(QUEUED_ORDERS_MAX_PER_PLAYER).fill({
        id: "x",
        playerId: "p",
        status: "queued",
        sequenceIndex: 0,
      } as unknown as QueuedOrder);
      mockGetAdminDb.mockReturnValue(
        fakeDb({ queueDocs: full }) as unknown as ReturnType<typeof getAdminDb>
      );
      await expect(
        enqueueOrderServer({
          playerId: "p",
          kind: "recruit_on_tile",
          params: {
            kind: "recruit_on_tile",
            tileId: "t",
            unitType: "ground",
          } as QueuedOrderParams,
        })
      ).rejects.toThrow(QueuedOrderQueueFullError);
    });

    it("persists a new order with sequenceIndex = current queue size", async () => {
      const sink: { id?: string; data?: unknown } = {};
      mockGetAdminDb.mockReturnValue(
        fakeDb({ queueDocs: [{} as QueuedOrder, {} as QueuedOrder], setSink: sink }) as unknown as ReturnType<typeof getAdminDb>
      );
      const out = await enqueueOrderServer({
        playerId: "p",
        kind: "recruit_on_tile",
        params: {
          kind: "recruit_on_tile",
          tileId: "t",
          unitType: "ground",
        } as QueuedOrderParams,
      });
      expect(out.sequenceIndex).toBe(2);
      expect(out.status).toBe("queued");
      expect(out.playerId).toBe("p");
      expect(sink.data).toBeDefined();
    });
  });

  describe("listOrdersForPlayerServer + readQueuedOrdersForPlayer", () => {
    it("returns orders sorted by sequenceIndex", async () => {
      const orders: QueuedOrder[] = [
        { sequenceIndex: 2 } as unknown as QueuedOrder,
        { sequenceIndex: 0 } as unknown as QueuedOrder,
        { sequenceIndex: 1 } as unknown as QueuedOrder,
      ];
      mockGetAdminDb.mockReturnValue(
        fakeDb({ queueDocs: orders }) as unknown as ReturnType<typeof getAdminDb>
      );
      const out = await listOrdersForPlayerServer("p", false);
      expect(out.map((o) => o.sequenceIndex)).toEqual([0, 1, 2]);
    });

    it("readQueuedOrdersForPlayer returns queued-only sorted", async () => {
      const orders: QueuedOrder[] = [
        { sequenceIndex: 1 } as unknown as QueuedOrder,
        { sequenceIndex: 0 } as unknown as QueuedOrder,
      ];
      const db = fakeDb({ queueDocs: orders });
      const out = await readQueuedOrdersForPlayer(db, "p");
      expect(out.map((o) => o.sequenceIndex)).toEqual([0, 1]);
    });
  });

  describe("cancelOrderServer", () => {
    it("throws QueuedOrderNotFoundError when the order doesn't exist", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({ cancelExists: false }) as unknown as ReturnType<typeof getAdminDb>
      );
      await expect(
        cancelOrderServer({ orderId: "o", callerUserId: "p" })
      ).rejects.toThrow(QueuedOrderNotFoundError);
    });

    it("throws QueuedOrderForbiddenError when caller is not the owner", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({
          cancelExists: true,
          cancelInitial: {
            id: "o",
            playerId: "owner",
            status: "queued",
          } as unknown as QueuedOrder,
        }) as unknown as ReturnType<typeof getAdminDb>
      );
      await expect(
        cancelOrderServer({ orderId: "o", callerUserId: "other" })
      ).rejects.toThrow(QueuedOrderForbiddenError);
    });

    it("returns the order unchanged when already non-queued (idempotent)", async () => {
      mockGetAdminDb.mockReturnValue(
        fakeDb({
          cancelExists: true,
          cancelInitial: {
            id: "o",
            playerId: "p",
            status: "executed",
          } as unknown as QueuedOrder,
        }) as unknown as ReturnType<typeof getAdminDb>
      );
      const out = await cancelOrderServer({ orderId: "o", callerUserId: "p" });
      expect(out.status).toBe("executed");
    });

    it("marks the order cancelled when it's currently queued", async () => {
      const updateSink: { ref?: unknown; updates?: Partial<QueuedOrder> } = {};
      mockGetAdminDb.mockReturnValue(
        fakeDb({
          cancelExists: true,
          cancelInitial: {
            id: "o",
            playerId: "p",
            status: "queued",
          } as unknown as QueuedOrder,
          txUpdateSink: updateSink,
        }) as unknown as ReturnType<typeof getAdminDb>
      );
      const out = await cancelOrderServer({ orderId: "o", callerUserId: "p" });
      expect(out.status).toBe("cancelled");
      expect(updateSink.updates?.status).toBe("cancelled");
      expect(updateSink.updates?.resultSummary).toBe("Cancelled by player");
    });
  });

  describe("markOrderResultInTx", () => {
    it("emits a tx.update with status + resultSummary + executedAt", () => {
      const updateSink: { ref?: unknown; updates?: Partial<QueuedOrder> } = {};
      const tx = {
        update: (ref: unknown, updates: Partial<QueuedOrder>) => {
          updateSink.ref = ref;
          updateSink.updates = updates;
        },
      } as unknown as Transaction;
      const db = {
        collection: () => ({ doc: () => ({ __ref: true }) }),
      } as unknown as Firestore;

      markOrderResultInTx({
        tx,
        db,
        order: { id: "o" } as QueuedOrder,
        status: "executed",
        resultSummary: "done",
        now: new Date("2026-01-01"),
      });
      expect(updateSink.updates?.status).toBe("executed");
      expect(updateSink.updates?.resultSummary).toBe("done");
    });

    it("includes resultRefId when provided", () => {
      const updateSink: { ref?: unknown; updates?: Partial<QueuedOrder> } = {};
      const tx = {
        update: (ref: unknown, updates: Partial<QueuedOrder>) => {
          updateSink.ref = ref;
          updateSink.updates = updates;
        },
      } as unknown as Transaction;
      const db = {
        collection: () => ({ doc: () => ({ __ref: true }) }),
      } as unknown as Firestore;
      markOrderResultInTx({
        tx,
        db,
        order: { id: "o" } as QueuedOrder,
        status: "failed",
        resultSummary: "boom",
        resultRefId: "ref-1",
        now: new Date(),
      });
      expect(updateSink.updates?.resultRefId).toBe("ref-1");
    });
  });
});
