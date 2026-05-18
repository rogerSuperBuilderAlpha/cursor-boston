/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Reusable client-side Firebase mocks (firebase/firestore + firebase/auth +
 * @/lib/firebase swappable singleton).
 *
 * Consolidates patterns from:
 * - __tests__/lib/mentorship-data.test.ts (swappable db)
 * - __tests__/lib/badges/data.test.ts (swappable db + auth)
 * - __tests__/lib/submissions.test.ts (firebase/firestore module mock)
 *
 * Call `mockFirestoreClient()` (or `mockFirebaseAll()`) at the TOP of a test
 * file — these helpers register jest.mock() calls which Jest hoists.
 */

/**
 * Builder for `firebase/firestore` client SDK mock.
 *
 * After calling, the firebase/firestore module is mocked so that:
 * - collection / addDoc / getDocs / query / where / serverTimestamp /
 *   onSnapshot / doc / setDoc / updateDoc / deleteDoc / orderBy / limit /
 *   startAfter / Timestamp.now()
 *
 * are all jest.fn()s that return predictable shapes. Tests can grab the
 * returned spies map and configure mockResolvedValue/mockReturnValue as
 * needed.
 *
 * NOTE: jest.mock() is hoisted by Jest's babel transform, so this function
 * must be called at the top level of the test file (before any imports
 * from the module under test).
 */
export interface FirestoreClientSpies {
  collection: jest.Mock;
  doc: jest.Mock;
  addDoc: jest.Mock;
  setDoc: jest.Mock;
  updateDoc: jest.Mock;
  deleteDoc: jest.Mock;
  getDoc: jest.Mock;
  getDocs: jest.Mock;
  query: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  startAfter: jest.Mock;
  onSnapshot: jest.Mock;
  serverTimestamp: jest.Mock;
}

/**
 * Returns a fresh spy bag. Tests must register the mock themselves at
 * file top:
 *
 * ```ts
 * const fsSpies = makeFirestoreClientSpies();
 * jest.mock("firebase/firestore", () => createFirestoreClientModule(fsSpies));
 * ```
 *
 * This split lets the spies be referenced inside the factory while keeping
 * jest.mock() hoist-safe.
 */
export function makeFirestoreClientSpies(): FirestoreClientSpies {
  return {
    collection: jest.fn((_db: unknown, name: string) => ({ __coll: name })),
    doc: jest.fn((_db: unknown, ...path: string[]) => ({ __doc: path.join("/") })),
    addDoc: jest.fn(async () => ({ id: "doc-new" })),
    setDoc: jest.fn(async () => undefined),
    updateDoc: jest.fn(async () => undefined),
    deleteDoc: jest.fn(async () => undefined),
    getDoc: jest.fn(async () => ({ exists: () => false, data: () => undefined })),
    getDocs: jest.fn(async () => ({ docs: [], size: 0, empty: true })),
    query: jest.fn((...args: unknown[]) => ({ __q: args })),
    where: jest.fn((...args: unknown[]) => ({ __w: args })),
    orderBy: jest.fn((...args: unknown[]) => ({ __o: args })),
    limit: jest.fn((...args: unknown[]) => ({ __l: args })),
    startAfter: jest.fn((...args: unknown[]) => ({ __s: args })),
    onSnapshot: jest.fn(() => () => {}),
    serverTimestamp: jest.fn(() => ({ __ts: "now" })),
  };
}

/**
 * Module factory for the jest.mock("firebase/firestore", ...) call. Use
 * with `makeFirestoreClientSpies()` above.
 */
export function createFirestoreClientModule(spies: FirestoreClientSpies) {
  return {
    collection: (...a: unknown[]) => spies.collection(...a),
    doc: (...a: unknown[]) => spies.doc(...a),
    addDoc: (...a: unknown[]) => spies.addDoc(...a),
    setDoc: (...a: unknown[]) => spies.setDoc(...a),
    updateDoc: (...a: unknown[]) => spies.updateDoc(...a),
    deleteDoc: (...a: unknown[]) => spies.deleteDoc(...a),
    getDoc: (...a: unknown[]) => spies.getDoc(...a),
    getDocs: (...a: unknown[]) => spies.getDocs(...a),
    query: (...a: unknown[]) => spies.query(...a),
    where: (...a: unknown[]) => spies.where(...a),
    orderBy: (...a: unknown[]) => spies.orderBy(...a),
    limit: (...a: unknown[]) => spies.limit(...a),
    startAfter: (...a: unknown[]) => spies.startAfter(...a),
    onSnapshot: (...a: unknown[]) => spies.onSnapshot(...a),
    serverTimestamp: () => spies.serverTimestamp(),
    Timestamp: {
      now: () => ({ __ts: "now" }),
      fromMillis: (ms: number) => ({ __ts: ms }),
      fromDate: (d: Date) => ({ __ts: d.getTime() }),
    },
  };
}

/**
 * `@/lib/firebase` swappable singleton mock. Pattern from
 * __tests__/lib/mentorship-data.test.ts:
 *
 * ```ts
 * jest.mock("@/lib/firebase", () => createSwappableFirebaseModule());
 * const { setDb, setAuth } = getSwappableFirebaseHandles();
 * setDb(myFakeDb);
 * ```
 *
 * Provides `db`, `auth`, `storage` getters that return whatever was last
 * passed to `__setDb()` / `__setAuth()` / `__setStorage()`.
 */
export function createSwappableFirebaseModule() {
  let _db: unknown = { __fake: "db" };
  let _auth: unknown = { currentUser: null };
  let _storage: unknown = { __fake: "storage" };
  return {
    get db() {
      return _db;
    },
    get auth() {
      return _auth;
    },
    get storage() {
      return _storage;
    },
    __setDb(next: unknown) {
      _db = next;
    },
    __setAuth(next: unknown) {
      _auth = next;
    },
    __setStorage(next: unknown) {
      _storage = next;
    },
  };
}

/**
 * After registering the swappable module via jest.mock(),
 * call this to get typed handles to the setters.
 *
 * ```ts
 * jest.mock("@/lib/firebase", () => createSwappableFirebaseModule());
 * const { setDb, setAuth } = getSwappableFirebaseHandles();
 * ```
 */
export function getSwappableFirebaseHandles(): {
  setDb: (next: unknown) => void;
  setAuth: (next: unknown) => void;
  setStorage: (next: unknown) => void;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/lib/firebase") as {
    __setDb: (next: unknown) => void;
    __setAuth: (next: unknown) => void;
    __setStorage: (next: unknown) => void;
  };
  return {
    setDb: mod.__setDb,
    setAuth: mod.__setAuth,
    setStorage: mod.__setStorage,
  };
}
