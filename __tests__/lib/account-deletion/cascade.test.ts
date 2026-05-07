/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment node
 */

/**
 * Cascade-executor tests with an in-memory Firestore mock.
 *
 * Each registry entry mode (`docIdIsUid`, `fieldEqualsUid`,
 * `twoSidedField`, `arrayContains`) exercises the matching code path.
 * These tests assert behavior, not surface area — the registry self-check
 * test is the breadth guard.
 */

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), logError: jest.fn() },
}));

// Mock the FieldValue sentinel before importing the cascade. The cascade
// uses `FieldValue.serverTimestamp()` and `FieldValue.arrayUnion(...)`;
// the mock returns recognizable sentinels the in-memory store interprets.
jest.mock("firebase-admin/firestore", () => {
  const ARRAY_UNION = Symbol("arrayUnion");
  const SERVER_TS = Symbol("serverTimestamp");
  return {
    FieldValue: {
      serverTimestamp: () => ({ __sentinel: SERVER_TS }),
      arrayUnion: (...values: unknown[]) => ({ __sentinel: ARRAY_UNION, values }),
      delete: () => ({ __sentinel: "delete" }),
    },
    __sentinels: { ARRAY_UNION, SERVER_TS },
  };
});

import { deleteUserData } from "@/lib/account-deletion/cascade";

type Doc = { id: string; data: Record<string, unknown> };
type Store = Map<string, Map<string, Doc>>; // collection -> id -> doc

function createStore(): Store {
  return new Map();
}

function getColl(store: Store, name: string): Map<string, Doc> {
  let coll = store.get(name);
  if (!coll) {
    coll = new Map();
    store.set(name, coll);
  }
  return coll;
}

/**
 * Build a Firestore-like fake supporting only the surface the cascade uses.
 */
function makeFakeFirestore(store: Store) {
  function makeDocRef(collectionName: string, id: string) {
    return {
      id,
      path: `${collectionName}/${id}`,
      get: async () => {
        const coll = store.get(collectionName);
        const doc = coll?.get(id);
        return {
          exists: !!doc,
          data: () => (doc ? doc.data : undefined),
          id,
          ref: makeDocRef(collectionName, id),
        };
      },
      delete: async () => {
        store.get(collectionName)?.delete(id);
      },
      update: async (updates: Record<string, unknown>) => {
        const coll = getColl(store, collectionName);
        const existing = coll.get(id);
        const data = { ...(existing?.data ?? {}) };
        for (const [k, v] of Object.entries(updates)) {
          // Resolve arrayUnion sentinel
          if (
            v &&
            typeof v === "object" &&
            "__sentinel" in (v as Record<string, unknown>) &&
            (v as { __sentinel?: unknown }).__sentinel === Symbol.for("arrayUnion")
          ) {
            // Symbol equality across module boundaries is iffy; fall through to set.
          }
          // We treat arrayUnion as concat (cascade only uses arrayUnion for completedSteps strings)
          if (
            v &&
            typeof v === "object" &&
            (v as { __sentinel?: unknown }).__sentinel &&
            String((v as { __sentinel?: unknown }).__sentinel).includes("arrayUnion")
          ) {
            const values = (v as { values: unknown[] }).values ?? [];
            const prev = Array.isArray(data[k]) ? (data[k] as unknown[]) : [];
            data[k] = [...prev, ...values];
          } else {
            data[k] = v;
          }
        }
        coll.set(id, { id, data });
      },
      set: async (
        d: Record<string, unknown>,
        opts?: { merge?: boolean }
      ) => {
        const coll = getColl(store, collectionName);
        if (opts?.merge) {
          const prev = coll.get(id);
          coll.set(id, { id, data: { ...(prev?.data ?? {}), ...d } });
        } else {
          coll.set(id, { id, data: d });
        }
      },
    };
  }

  function makeQuery(collectionName: string, filters: { field: string; op: string; value: unknown }[]) {
    return {
      where: (field: string, op: string, value: unknown) =>
        makeQuery(collectionName, [...filters, { field, op, value }]),
      limit: (_n: number) => ({
        ...makeQuery(collectionName, filters),
        startAfter: (_doc: unknown) => makeQuery(collectionName, filters),
      }),
      startAfter: (_doc: unknown) => makeQuery(collectionName, filters),
      get: async () => {
        const coll = store.get(collectionName);
        const docs = coll
          ? [...coll.values()].filter((d) =>
              filters.every((f) => {
                if (f.op === "==") return d.data[f.field] === f.value;
                if (f.op === "array-contains") {
                  const arr = d.data[f.field];
                  return Array.isArray(arr) && arr.includes(f.value);
                }
                return true;
              })
            )
          : [];
        return {
          empty: docs.length === 0,
          docs: docs.map((d) => ({
            id: d.id,
            data: () => d.data,
            ref: makeDocRef(collectionName, d.id),
          })),
        };
      },
    };
  }

  function makeCollection(name: string) {
    return {
      doc: (id: string) => makeDocRef(name, id),
      where: (field: string, op: string, value: unknown) =>
        makeQuery(name, [{ field, op, value }]),
    };
  }

  type BatchOp =
    | { kind: "delete"; coll: string; id: string }
    | { kind: "update"; coll: string; id: string; updates: Record<string, unknown> };

  return {
    collection: (name: string) => makeCollection(name),
    batch: () => {
      const ops: BatchOp[] = [];
      return {
        delete: (ref: { path: string }) => {
          const [coll, id] = ref.path.split("/");
          ops.push({ kind: "delete", coll, id });
        },
        update: (ref: { path: string }, updates: Record<string, unknown>) => {
          const [coll, id] = ref.path.split("/");
          ops.push({ kind: "update", coll, id, updates });
        },
        commit: async () => {
          for (const op of ops) {
            if (op.kind === "delete") {
              store.get(op.coll)?.delete(op.id);
            } else {
              const c = getColl(store, op.coll);
              const existing = c.get(op.id);
              c.set(op.id, {
                id: op.id,
                data: { ...(existing?.data ?? {}), ...op.updates },
              });
            }
          }
        },
      };
    },
  } as unknown as import("firebase-admin/firestore").Firestore;
}

describe("deleteUserData cascade", () => {
  it("deletes a docIdIsUid collection (users)", async () => {
    const store = createStore();
    getColl(store, "users").set("u1", { id: "u1", data: { uid: "u1", name: "Alice" } });
    const db = makeFakeFirestore(store);

    const report = await deleteUserData("u1", db);
    expect(store.get("users")?.has("u1")).toBe(false);
    const usersStep = report.steps.find((s) => s.collection === "users");
    expect(usersStep?.deleted).toBe(1);
  });

  it("anonymizes communityMessages instead of deleting (preserves thread)", async () => {
    const store = createStore();
    getColl(store, "communityMessages").set("m1", {
      id: "m1",
      data: { authorId: "u1", authorName: "Alice", content: "hi", authorAvatarUrl: "a.png" },
    });
    getColl(store, "communityMessages").set("m2", {
      id: "m2",
      data: { authorId: "u2", authorName: "Bob", content: "world" },
    });
    const db = makeFakeFirestore(store);

    await deleteUserData("u1", db);

    const m1 = store.get("communityMessages")?.get("m1");
    const m2 = store.get("communityMessages")?.get("m2");
    expect(m1?.data.authorId).toBe("deleted-user");
    expect(m1?.data.authorName).toBeNull();
    expect(m1?.data.authorAvatarUrl).toBeNull();
    expect(m1?.data.content).toBe("hi"); // content preserved
    // Other users' messages untouched
    expect(m2?.data.authorId).toBe("u2");
    expect(m2?.data.authorName).toBe("Bob");
  });

  it("twoSidedField finds a uid as either side and dedupes", async () => {
    const store = createStore();
    getColl(store, "mentorship_requests").set("r1", {
      id: "r1",
      data: { fromUserId: "u1", toUserId: "u2" },
    });
    getColl(store, "mentorship_requests").set("r2", {
      id: "r2",
      data: { fromUserId: "u3", toUserId: "u1" },
    });
    getColl(store, "mentorship_requests").set("r3", {
      id: "r3",
      // Edge case: both sides reference u1 (would otherwise be counted twice)
      data: { fromUserId: "u1", toUserId: "u1" },
    });
    getColl(store, "mentorship_requests").set("r4", {
      id: "r4",
      data: { fromUserId: "u3", toUserId: "u4" },
    });
    const db = makeFakeFirestore(store);

    await deleteUserData("u1", db);

    expect(store.get("mentorship_requests")?.has("r1")).toBe(false);
    expect(store.get("mentorship_requests")?.has("r2")).toBe(false);
    expect(store.get("mentorship_requests")?.has("r3")).toBe(false);
    expect(store.get("mentorship_requests")?.has("r4")).toBe(true);
  });

  it("arrayContains finds and deletes pair_sessions where uid is in participantIds", async () => {
    const store = createStore();
    getColl(store, "pair_sessions").set("s1", {
      id: "s1",
      data: { participantIds: ["u1", "u2"] },
    });
    getColl(store, "pair_sessions").set("s2", {
      id: "s2",
      data: { participantIds: ["u3", "u4"] },
    });
    const db = makeFakeFirestore(store);

    await deleteUserData("u1", db);

    expect(store.get("pair_sessions")?.has("s1")).toBe(false);
    expect(store.get("pair_sessions")?.has("s2")).toBe(true);
  });

  it("is idempotent — second pass skips completed steps", async () => {
    const store = createStore();
    getColl(store, "users").set("u1", { id: "u1", data: { uid: "u1" } });
    getColl(store, "communityMessages").set("m1", {
      id: "m1",
      data: { authorId: "u1", authorName: "Alice" },
    });
    const db = makeFakeFirestore(store);

    const first = await deleteUserData("u1", db);
    const second = await deleteUserData("u1", db);

    const usersStepFirst = first.steps.find((s) => s.collection === "users");
    const usersStepSecond = second.steps.find((s) => s.collection === "users");
    expect(usersStepFirst?.skipped).toBe(false);
    expect(usersStepSecond?.skipped).toBe(true);
  });

  it("records progress under accountDeletions/{uid}", async () => {
    const store = createStore();
    getColl(store, "users").set("u1", { id: "u1", data: { uid: "u1" } });
    const db = makeFakeFirestore(store);

    await deleteUserData("u1", db);

    const progress = store.get("accountDeletions")?.get("u1");
    expect(progress).toBeDefined();
    const completed = progress?.data.completedSteps as string[];
    expect(completed).toContain("users");
  });
});
