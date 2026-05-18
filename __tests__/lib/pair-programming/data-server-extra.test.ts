/**
 * @jest-environment node
 *
 * Coverage push #66 — complementary tests for
 * lib/pair-programming/data-server.ts. Existing data-server.test.ts
 * covered exactly 1 path (treats-undefined-payload-as-not-found).
 * This file picks up the remaining ~80%: profile read, full-active
 * scan, create-or-update branches, request create, sent/received
 * list, the full transaction (404 / unauthorized / already-
 * responded / decline / accept-creates-session), proposedTime
 * fallback.
 */
const mockGetAdminDb = jest.fn();
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
}));

import {
  PairRequestAlreadyRespondedError,
  PairRequestNotFoundError,
  PairRequestUnauthorizedError,
  createOrUpdatePairProfileServer,
  createPairRequestServer,
  getAllActiveProfilesServer,
  getPairProfileServer,
  getPairRequestsForUserServer,
  respondToPairRequestServer,
} from "@/lib/pair-programming/data-server";

function makeDb() {
  const docByPath = new Map<
    string,
    { exists: boolean; data?: Record<string, unknown> }
  >();
  const queryDocsByColl = new Map<
    string,
    Array<{ id: string; data: () => Record<string, unknown> }>
  >();
  const txOps: Array<{ op: string; args: unknown[] }> = [];
  const refsByPath = new Map<string, { id?: string }>();

  let pairingCounter = 0;
  function nextSessionId() {
    pairingCounter += 1;
    return `session-${pairingCounter}`;
  }

  function makeQueryChain(name: string) {
    type Chain = Record<string, jest.Mock>;
    const chain: Chain = {};
    chain.where = jest.fn(() => chain as unknown as Chain);
    chain.orderBy = jest.fn(() => chain as unknown as Chain);
    chain.limit = jest.fn(() => chain as unknown as Chain);
    chain.startAfter = jest.fn(() => chain as unknown as Chain);
    chain.get = jest.fn(async () => ({
      docs: queryDocsByColl.get(name) ?? [],
    }));
    return chain;
  }

  function makeCollection(name: string) {
    const chain = makeQueryChain(name) as Record<string, jest.Mock>;
    chain.doc = jest.fn((id?: string) => {
      if (!id) {
        // Anonymous doc (e.g. tx.set for sessions)
        return { id: nextSessionId() };
      }
      const path = `${name}/${id}`;
      const ref = { id, __path: path } as { id: string; __path: string };
      refsByPath.set(path, ref);
      return {
        id,
        get: jest.fn().mockImplementation(() => {
          const entry = docByPath.get(path) ?? { exists: false };
          return Promise.resolve({
            exists: entry.exists,
            data: () => entry.data ?? {},
            id,
          });
        }),
        update: jest.fn().mockResolvedValue(undefined),
        set: jest.fn().mockResolvedValue(undefined),
      };
    });
    chain.add = jest.fn().mockResolvedValue({ id: `added-${Date.now()}` });
    return chain;
  }

  const collection = jest.fn((name: string) => makeCollection(name));

  const txGet = jest.fn(async (ref: { __path?: string; id?: string }) => {
    const path = ref.__path ?? `pair_requests/${ref.id ?? ""}`;
    const entry = docByPath.get(path) ?? { exists: false };
    return {
      exists: entry.exists,
      data: () => entry.data ?? null,
    };
  });
  const txSet = jest.fn((ref, payload) =>
    txOps.push({ op: "set", args: [ref, payload] })
  );
  const txUpdate = jest.fn((ref, payload) =>
    txOps.push({ op: "update", args: [ref, payload] })
  );

  const runTransaction = jest.fn(async (fn) =>
    fn({ get: txGet, set: txSet, update: txUpdate })
  );

  return {
    db: { collection, runTransaction },
    __set: {
      setDoc: (coll: string, id: string, entry: { exists: boolean; data?: Record<string, unknown> }) => {
        docByPath.set(`${coll}/${id}`, entry);
      },
      setQueryDocs: (
        coll: string,
        docs: Array<{ id: string; data: () => Record<string, unknown> }>
      ) => {
        queryDocsByColl.set(coll, docs);
      },
    },
    spies: { txGet, txSet, txUpdate, txOps },
  };
}

beforeEach(() => mockGetAdminDb.mockReset());

describe("error classes", () => {
  it("propagate name + message", () => {
    expect(new PairRequestNotFoundError().name).toBe("PairRequestNotFoundError");
    expect(new PairRequestUnauthorizedError().name).toBe(
      "PairRequestUnauthorizedError"
    );
    expect(new PairRequestAlreadyRespondedError().name).toBe(
      "PairRequestAlreadyRespondedError"
    );
  });
});

describe("getPairProfileServer", () => {
  it("returns null when admin db is missing", async () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    expect(await getPairProfileServer("u1")).toBeNull();
  });

  it("returns null when the doc doesn't exist", async () => {
    const { db, __set } = makeDb();
    __set.setDoc("pair_profiles", "u1", { exists: false });
    mockGetAdminDb.mockReturnValueOnce(db);
    expect(await getPairProfileServer("u1")).toBeNull();
  });

  it("returns the merged doc with userId from doc.id when found", async () => {
    const { db, __set } = makeDb();
    __set.setDoc("pair_profiles", "u1", {
      exists: true,
      data: { displayName: "A" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    expect(await getPairProfileServer("u1")).toEqual(
      expect.objectContaining({ userId: "u1", displayName: "A" })
    );
  });
});

describe("getAllActiveProfilesServer", () => {
  it("returns [] when admin db is missing", async () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    expect(await getAllActiveProfilesServer()).toEqual([]);
  });

  it("maps query docs", async () => {
    const { db, __set } = makeDb();
    __set.setQueryDocs("pair_profiles", [
      { id: "u1", data: () => ({}) },
      { id: "u2", data: () => ({}) },
    ]);
    mockGetAdminDb.mockReturnValueOnce(db);
    expect((await getAllActiveProfilesServer()).map((p) => p.userId)).toEqual([
      "u1",
      "u2",
    ]);
  });
});

describe("createOrUpdatePairProfileServer", () => {
  it("throws when admin db is missing", async () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    await expect(
      createOrUpdatePairProfileServer("u1", {} as never)
    ).rejects.toThrow("Firebase Admin not initialized");
  });

  it("updates when the doc exists", async () => {
    const { db, __set } = makeDb();
    __set.setDoc("pair_profiles", "u1", { exists: true });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      createOrUpdatePairProfileServer("u1", { displayName: "A" } as never)
    ).resolves.toBeUndefined();
  });

  it("creates when the doc doesn't exist", async () => {
    const { db, __set } = makeDb();
    __set.setDoc("pair_profiles", "u-new", { exists: false });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      createOrUpdatePairProfileServer("u-new", { displayName: "A" } as never)
    ).resolves.toBeUndefined();
  });
});

describe("createPairRequestServer", () => {
  it("throws when admin db is missing", async () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    await expect(
      createPairRequestServer({} as never)
    ).rejects.toThrow("Firebase Admin not initialized");
  });

  it("returns the new id", async () => {
    const { db } = makeDb();
    mockGetAdminDb.mockReturnValueOnce(db);
    const id = await createPairRequestServer({
      fromUserId: "a",
      toUserId: "b",
      sessionType: "live",
    } as never);
    expect(id).toMatch(/^added-/);
  });
});

describe("getPairRequestsForUserServer", () => {
  it("returns [] when admin db is missing", async () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    expect(await getPairRequestsForUserServer("u1", "sent")).toEqual([]);
  });

  it("maps the matched docs (received)", async () => {
    const { db, __set } = makeDb();
    __set.setQueryDocs("pair_requests", [
      { id: "r1", data: () => ({ status: "pending" }) },
    ]);
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await getPairRequestsForUserServer("u1", "received");
    expect(out).toEqual([{ id: "r1", status: "pending" }]);
  });
});

describe("respondToPairRequestServer", () => {
  it("throws when admin db is missing", async () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    await expect(
      respondToPairRequestServer("r1", "u1", "accept")
    ).rejects.toThrow("Firebase Admin not initialized");
  });

  it("throws not-found when request doc is missing", async () => {
    const { db, __set } = makeDb();
    __set.setDoc("pair_requests", "r1", { exists: false });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      respondToPairRequestServer("r1", "u1", "accept")
    ).rejects.toBeInstanceOf(PairRequestNotFoundError);
  });

  it("throws unauthorized when caller isn't toUserId", async () => {
    const { db, __set } = makeDb();
    __set.setDoc("pair_requests", "r1", {
      exists: true,
      data: { toUserId: "other", status: "pending", fromUserId: "a" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      respondToPairRequestServer("r1", "u1", "accept")
    ).rejects.toBeInstanceOf(PairRequestUnauthorizedError);
  });

  it("throws already-responded when status !== 'pending'", async () => {
    const { db, __set } = makeDb();
    __set.setDoc("pair_requests", "r1", {
      exists: true,
      data: { toUserId: "u1", status: "accepted", fromUserId: "a" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      respondToPairRequestServer("r1", "u1", "accept")
    ).rejects.toBeInstanceOf(PairRequestAlreadyRespondedError);
  });

  it("declines without creating a session", async () => {
    const { db, __set, spies } = makeDb();
    __set.setDoc("pair_requests", "r1", {
      exists: true,
      data: { toUserId: "u1", status: "pending", fromUserId: "a" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await respondToPairRequestServer("r1", "u1", "decline");
    expect(out.status).toBe("declined");
    expect(out.sessionId).toBeUndefined();
    expect(spies.txSet).not.toHaveBeenCalled();
  });

  it("accepts and creates a session with proposedTime", async () => {
    const { db, __set, spies } = makeDb();
    __set.setDoc("pair_requests", "r1", {
      exists: true,
      data: {
        toUserId: "u1",
        status: "pending",
        fromUserId: "from",
        sessionType: "deep-dive",
        proposedTime: "2026-05-20T00:00:00Z",
      },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await respondToPairRequestServer("r1", "u1", "accept");
    expect(out.status).toBe("accepted");
    expect(out.sessionId).toMatch(/^session-/);
    expect(spies.txSet).toHaveBeenCalledTimes(1);
    const payload = spies.txSet.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.scheduledTime).toBe("2026-05-20T00:00:00Z");
    expect(payload.participantIds).toEqual(["from", "u1"]);
    expect(payload.sessionType).toBe("deep-dive");
  });

  it("accepts and falls back to scheduledTime=null when proposedTime missing", async () => {
    const { db, __set, spies } = makeDb();
    __set.setDoc("pair_requests", "r2", {
      exists: true,
      data: {
        toUserId: "u1",
        status: "pending",
        fromUserId: "from",
        sessionType: "live",
        // no proposedTime
      },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await respondToPairRequestServer("r2", "u1", "accept");
    expect(out.status).toBe("accepted");
    const payload = spies.txSet.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.scheduledTime).toBeNull();
  });
});
