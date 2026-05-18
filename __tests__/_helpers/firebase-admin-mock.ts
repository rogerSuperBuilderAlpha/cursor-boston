/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Reusable Firestore Admin SDK mock builders.
 *
 * Consolidates the per-test fakeDb builders that pushes #23-44 grew inline
 * (e.g. __tests__/lib/hackathon-teams-board-server.test.ts:14-71,
 *  __tests__/lib/profile-bundle-server.test.ts:23-77,
 *  __tests__/lib/summer-cohort-auto-admit.test.ts:44-99).
 *
 * Coverage tests should reach for these helpers before rolling new mocks.
 */

export type FakeDocSnap = {
  id: string;
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
  ref?: unknown;
};

export type FakeQuerySnap = {
  docs: FakeDocSnap[];
  size: number;
  empty: boolean;
};

/**
 * Snap-shape factory. Mirrors a real Firestore DocumentSnapshot for both
 * existing-doc reads (`exists:true, data() → record`) and the get-by-doc-id
 * miss path (`exists:false, data() → undefined`).
 */
export function makeDoc(id: string, data: Record<string, unknown> | undefined): FakeDocSnap {
  if (data === undefined) {
    return { id, exists: false, data: () => undefined };
  }
  return { id, exists: true, data: () => data };
}

/** Query-snap factory — wraps an array of `makeDoc()` results. */
export function makeQuerySnap(docs: FakeDocSnap[]): FakeQuerySnap {
  return { docs, size: docs.length, empty: docs.length === 0 };
}

/**
 * Timestamp-like proxy. Firestore Timestamps expose `.toDate()` and
 * `.toMillis()`; this matches both so the production code's narrowing
 * (`"toDate" in v`) and direct millis access work transparently.
 */
export function tsLike(iso: string) {
  const date = new Date(iso);
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
  };
}

/** Reverse Timestamp helper for tests that want to feed milliseconds. */
export function tsLikeMs(ms: number) {
  return {
    toDate: () => new Date(ms),
    toMillis: () => ms,
  };
}

/**
 * Chain builder for `.where(...).orderBy(...).limit(...).get()` style reads.
 * Every chain method returns the same chain so tests can compose any order.
 *
 * Pass either:
 * - `{ docs: [...] }` for one-shot reads (most common)
 * - `{ get: jest.fn().mockResolvedValueOnce(...).mockResolvedValueOnce(...) }`
 *   when a single chain is reused across multiple calls inside a single
 *   function under test.
 */
export interface ChainOpts {
  docs?: FakeDocSnap[];
  get?: jest.Mock;
}

export function makeChain(opts: ChainOpts = {}) {
  const get =
    opts.get ??
    jest.fn().mockResolvedValue(makeQuerySnap(opts.docs ?? []));

  const chain: Record<string, jest.Mock> = {};
  chain.where = jest.fn().mockReturnValue(chain);
  chain.orderBy = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.startAfter = jest.fn().mockReturnValue(chain);
  chain.endBefore = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.get = get;
  // count() returns an aggregate query whose .get() returns { data: () => ({ count }) }
  chain.count = jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: () => ({ count: opts.docs?.length ?? 0 }) }),
  });
  return chain;
}

/** Doc-ref builder for `.collection(...).doc(...)` style reads. */
export interface DocRefOpts {
  snap?: FakeDocSnap | null;
  get?: jest.Mock;
  set?: jest.Mock;
  update?: jest.Mock;
  delete?: jest.Mock;
}

export function makeDocRef(id: string, opts: DocRefOpts = {}) {
  const snap = opts.snap ?? makeDoc(id, undefined);
  return {
    id,
    get: opts.get ?? jest.fn().mockResolvedValue(snap),
    set: opts.set ?? jest.fn().mockResolvedValue(undefined),
    update: opts.update ?? jest.fn().mockResolvedValue(undefined),
    delete: opts.delete ?? jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Top-level fake Firestore Admin DB builder.
 *
 * `opts.collections` maps collection name → either:
 * - a `Record<docId, FakeDocSnap>` (looked up via `db.collection(x).doc(id)`)
 * - an array of `FakeDocSnap[]` (returned by `db.collection(x).where(...).get()`)
 * - a custom chain object (full control)
 *
 * Returns the db + a per-collection spy map so tests can assert on the
 * `.where()`, `.limit()`, etc. calls each route made.
 */
export interface FakeDbOpts {
  collections?: Record<
    string,
    | FakeDocSnap[]
    | { docs?: FakeDocSnap[]; byId?: Record<string, FakeDocSnap> }
    | ReturnType<typeof makeChain>
  >;
  runTransaction?: jest.Mock;
  batch?: jest.Mock;
  getAll?: jest.Mock;
}

export function makeFakeDb(opts: FakeDbOpts = {}) {
  const collectionSpies = new Map<
    string,
    {
      chain: ReturnType<typeof makeChain>;
      docs: Record<string, ReturnType<typeof makeDocRef>>;
    }
  >();

  const collection = jest.fn((name: string) => {
    let entry = collectionSpies.get(name);
    if (!entry) {
      const collDef = opts.collections?.[name];
      let docs: FakeDocSnap[] = [];
      let byId: Record<string, FakeDocSnap> = {};

      if (Array.isArray(collDef)) {
        docs = collDef;
      } else if (collDef && typeof collDef === "object" && "where" in collDef) {
        // Already a fully-built chain — use as-is.
        entry = {
          chain: collDef as ReturnType<typeof makeChain>,
          docs: {},
        };
        collectionSpies.set(name, entry);
        return entry.chain;
      } else if (collDef && typeof collDef === "object") {
        docs = collDef.docs ?? [];
        byId = collDef.byId ?? {};
      }

      const chain = makeChain({ docs });
      const docMap: Record<string, ReturnType<typeof makeDocRef>> = {};
      // Pre-build doc refs for known byId entries; lazy-build others.
      for (const [docId, snap] of Object.entries(byId)) {
        docMap[docId] = makeDocRef(docId, { snap });
      }
      // collection().doc(id) lookup → reuses pre-built or makes a new "exists:false" miss
      (chain as Record<string, unknown>).doc = jest.fn((docId: string) => {
        if (!docMap[docId]) {
          docMap[docId] = makeDocRef(docId, { snap: makeDoc(docId, undefined) });
        }
        return docMap[docId];
      });
      entry = { chain, docs: docMap };
      collectionSpies.set(name, entry);
    }
    return entry.chain;
  });

  const db = {
    collection,
    runTransaction:
      opts.runTransaction ??
      jest.fn(async (fn: (tx: unknown) => unknown) => {
        // Default transaction: tx.get(ref) reads via ref.get(); tx.update/set/delete are spies.
        const tx = {
          get: jest.fn(async (ref: { get?: () => Promise<unknown> }) =>
            ref.get ? ref.get() : { exists: false, data: () => undefined },
          ),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        };
        return fn(tx);
      }),
    batch:
      opts.batch ??
      jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      })),
    getAll:
      opts.getAll ??
      jest.fn(async (...refs: Array<{ get?: () => Promise<unknown> }>) => {
        return Promise.all(
          refs.map((r) =>
            r.get ? r.get() : { exists: false, data: () => undefined },
          ),
        );
      }),
  };

  return { db, collection, collectionSpies };
}

/** Convenience helper for tests that just want `getAdminDb` to return a fake. */
export function withFakeAdminDb<T>(
  mockGetAdminDb: jest.Mock,
  opts: FakeDbOpts = {},
): { db: ReturnType<typeof makeFakeDb>["db"]; collectionSpies: ReturnType<typeof makeFakeDb>["collectionSpies"] } & T {
  const { db, collectionSpies } = makeFakeDb(opts);
  mockGetAdminDb.mockReturnValue(db);
  return { db, collectionSpies } as ReturnType<typeof makeFakeDb> & T;
}
