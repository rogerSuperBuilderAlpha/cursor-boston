/**
 * @jest-environment node
 *
 * Smoke test for __tests__/_helpers/* — makes sure the shared mocks
 * import cleanly, compose with each other, and return the shapes the
 * Wave 1-5 backlog will rely on. If this file breaks, every downstream
 * coverage push will break with it.
 */
import {
  makeChain,
  makeDoc,
  makeDocRef,
  makeFakeDb,
  makeQuerySnap,
  tsLike,
  tsLikeMs,
  withFakeAdminDb,
} from "@/__tests__/_helpers/firebase-admin-mock";
import {
  createFirestoreClientModule,
  createSwappableFirebaseModule,
  makeFirestoreClientSpies,
} from "@/__tests__/_helpers/firebase-client-mock";
import {
  createServerAuthModule,
  clearCronSecret,
  makeServerAuthSpies,
  withCronSecret,
} from "@/__tests__/_helpers/server-auth-mock";
import {
  makeAuthedRequest,
  makeCronRequest,
  makeRequest,
  readJson,
} from "@/__tests__/_helpers/route-test-utils";

describe("__tests__/_helpers (smoke)", () => {
  describe("firebase-admin-mock", () => {
    it("makeDoc → exists:true when data is provided", () => {
      const d = makeDoc("u1", { displayName: "Alice" });
      expect(d.exists).toBe(true);
      expect(d.id).toBe("u1");
      expect(d.data()).toEqual({ displayName: "Alice" });
    });

    it("makeDoc → exists:false when data is undefined", () => {
      const d = makeDoc("u1", undefined);
      expect(d.exists).toBe(false);
      expect(d.data()).toBeUndefined();
    });

    it("makeQuerySnap exposes docs/size/empty", () => {
      const empty = makeQuerySnap([]);
      expect(empty).toEqual({ docs: [], size: 0, empty: true });
      const filled = makeQuerySnap([makeDoc("a", {}), makeDoc("b", {})]);
      expect(filled.size).toBe(2);
      expect(filled.empty).toBe(false);
    });

    it("tsLike + tsLikeMs match Firestore Timestamp shape", () => {
      const a = tsLike("2026-05-01T00:00:00.000Z");
      expect(a.toDate()).toEqual(new Date("2026-05-01T00:00:00.000Z"));
      expect(a.toMillis()).toBe(Date.parse("2026-05-01T00:00:00.000Z"));

      const b = tsLikeMs(1717000000000);
      expect(b.toMillis()).toBe(1717000000000);
      expect(b.toDate()).toEqual(new Date(1717000000000));
    });

    it("makeChain returns a chainable mock with where/orderBy/limit/get/count", async () => {
      const chain = makeChain({ docs: [makeDoc("a", { v: 1 })] });
      const result = await chain.where("x", "==", 1).orderBy("y").limit(10).get();
      expect(result.size).toBe(1);
      expect(chain.where).toHaveBeenCalledWith("x", "==", 1);
      expect(chain.orderBy).toHaveBeenCalledWith("y");
      expect(chain.limit).toHaveBeenCalledWith(10);
      // count() returns aggregate
      const agg = await chain.count().get();
      expect(agg.data()).toEqual({ count: 1 });
    });

    it("makeDocRef provides get/set/update/delete spies + snap", async () => {
      const ref = makeDocRef("d1", { snap: makeDoc("d1", { v: 2 }) });
      const snap = await ref.get();
      expect(snap.exists).toBe(true);
      expect(snap.data()).toEqual({ v: 2 });
      await ref.set({ x: 1 });
      expect(ref.set).toHaveBeenCalledWith({ x: 1 });
    });

    it("makeFakeDb routes collection() calls to per-name chains", async () => {
      const { db, collectionSpies } = makeFakeDb({
        collections: {
          users: [makeDoc("u1", { name: "A" })],
          orders: [],
        },
      });
      const usersSnap = await db.collection("users").where("x", "==", 1).get();
      expect(usersSnap.size).toBe(1);
      expect(collectionSpies.get("users")).toBeDefined();
      const ordersSnap = await db.collection("orders").get();
      expect(ordersSnap.empty).toBe(true);
    });

    it("makeFakeDb supports byId doc lookups", async () => {
      const { db } = makeFakeDb({
        collections: {
          users: {
            byId: { u1: makeDoc("u1", { name: "Alice" }) },
          },
        },
      });
      const refExists = (db.collection("users") as unknown as { doc: (id: string) => { get: () => Promise<unknown> } }).doc("u1");
      const refMiss = (db.collection("users") as unknown as { doc: (id: string) => { get: () => Promise<unknown> } }).doc("nope");
      const snapExists = (await refExists.get()) as { exists: boolean; data: () => unknown };
      const snapMiss = (await refMiss.get()) as { exists: boolean };
      expect(snapExists.exists).toBe(true);
      expect(snapExists.data()).toEqual({ name: "Alice" });
      expect(snapMiss.exists).toBe(false);
    });

    it("makeFakeDb.runTransaction proxies to a tx object with get/set/update", async () => {
      const { db } = makeFakeDb({});
      const txReturn = await db.runTransaction(async (tx) => {
        const t = tx as { set: jest.Mock };
        t.set({ __ref: 1 }, { x: 1 });
        return "done";
      });
      expect(txReturn).toBe("done");
    });

    it("withFakeAdminDb wires a getAdminDb spy to a fresh fakeDb", () => {
      const getAdminDb = jest.fn();
      const { db } = withFakeAdminDb(getAdminDb, {
        collections: { users: [] },
      });
      expect(getAdminDb()).toBe(db);
    });
  });

  describe("firebase-client-mock", () => {
    it("makeFirestoreClientSpies returns a complete spy bag", () => {
      const spies = makeFirestoreClientSpies();
      expect(typeof spies.collection).toBe("function");
      expect(typeof spies.addDoc).toBe("function");
      expect(typeof spies.onSnapshot).toBe("function");
    });

    it("createFirestoreClientModule binds the spies to module exports", async () => {
      const spies = makeFirestoreClientSpies();
      const mod = createFirestoreClientModule(spies);
      spies.addDoc.mockResolvedValueOnce({ id: "new-1" });
      const out = await mod.addDoc({}, { x: 1 });
      expect(out).toEqual({ id: "new-1" });
      expect(spies.addDoc).toHaveBeenCalledWith({}, { x: 1 });
      expect(mod.Timestamp.now()).toEqual({ __ts: "now" });
    });

    it("createSwappableFirebaseModule exposes db/auth + __setters that swap values", () => {
      const mod = createSwappableFirebaseModule();
      expect(mod.db).toEqual({ __fake: "db" });
      mod.__setDb({ __my: 1 });
      expect(mod.db).toEqual({ __my: 1 });
      mod.__setAuth({ currentUser: { uid: "u1" } });
      expect((mod.auth as { currentUser: { uid: string } }).currentUser.uid).toBe(
        "u1",
      );
    });
  });

  describe("server-auth-mock", () => {
    afterEach(() => clearCronSecret());

    it("makeServerAuthSpies → getVerifiedUser returns null by default", async () => {
      const spies = makeServerAuthSpies();
      expect(await spies.getVerifiedUser({} as never)).toBeNull();
    });

    it("mockVerifiedUser one-shots a user", async () => {
      const spies = makeServerAuthSpies();
      spies.mockVerifiedUser({ uid: "u1", email: "u@x.com" });
      const u = (await spies.getVerifiedUser({} as never)) as { uid: string; email: string };
      expect(u.uid).toBe("u1");
      expect(u.email).toBe("u@x.com");
      // Next call falls back to null again
      expect(await spies.getVerifiedUser({} as never)).toBeNull();
    });

    it("mockUnauthenticated → null", async () => {
      const spies = makeServerAuthSpies();
      spies.mockUnauthenticated();
      expect(await spies.getVerifiedUser({} as never)).toBeNull();
    });

    it("mockAuthError → rejects", async () => {
      const spies = makeServerAuthSpies();
      spies.mockAuthError(new Error("expired"));
      await expect(spies.getVerifiedUser({} as never)).rejects.toThrow("expired");
    });

    it("createServerAuthModule binds spies to module exports", async () => {
      const spies = makeServerAuthSpies();
      const mod = createServerAuthModule(spies);
      spies.mockVerifiedUser({ uid: "u9" });
      const u = (await mod.getVerifiedUser({} as never)) as { uid: string };
      expect(u.uid).toBe("u9");
    });

    it("withCronSecret + clearCronSecret manage process.env", () => {
      withCronSecret("hello");
      expect(process.env.CRON_SECRET).toBe("hello");
      clearCronSecret();
      expect(process.env.CRON_SECRET).toBeUndefined();
    });
  });

  describe("route-test-utils", () => {
    it("makeRequest defaults to GET with content-type json", async () => {
      const req = makeRequest({ path: "/api/x" });
      expect(req.method).toBe("GET");
      expect(req.url).toContain("/api/x");
      expect(req.headers.get("content-type")).toBe("application/json");
    });

    it("makeRequest JSON-stringifies object bodies on POST", async () => {
      const req = makeRequest({ method: "POST", body: { foo: 1 } });
      const body = await req.json();
      expect(body).toEqual({ foo: 1 });
    });

    it("makeRequest leaves string bodies untouched", async () => {
      const req = makeRequest({ method: "POST", body: '{"raw":true}' });
      const body = await req.json();
      expect(body).toEqual({ raw: true });
    });

    it("makeRequest applies searchParams", () => {
      const req = makeRequest({
        path: "/api/x",
        searchParams: { a: "1", b: "two" },
      });
      const url = new URL(req.url);
      expect(url.searchParams.get("a")).toBe("1");
      expect(url.searchParams.get("b")).toBe("two");
    });

    it("makeAuthedRequest sets Authorization: Bearer", () => {
      const req = makeAuthedRequest({ token: "abc" });
      expect(req.headers.get("authorization")).toBe("Bearer abc");
    });

    it("makeAuthedRequest defaults to 'Bearer test-token'", () => {
      const req = makeAuthedRequest();
      expect(req.headers.get("authorization")).toBe("Bearer test-token");
    });

    it("makeCronRequest sets x-cron-secret", () => {
      const req = makeCronRequest({ secret: "s3cret" });
      expect(req.headers.get("x-cron-secret")).toBe("s3cret");
    });

    it("readJson returns { status, body }", async () => {
      const fakeRes = new Response(JSON.stringify({ ok: true }), { status: 200 });
      const { status, body } = await readJson<{ ok: boolean }>(fakeRes);
      expect(status).toBe(200);
      expect(body).toEqual({ ok: true });
    });
  });
});
