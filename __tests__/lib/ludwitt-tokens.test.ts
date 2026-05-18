/**
 * @jest-environment node
 */
const adminDbMock = jest.fn();
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => adminDbMock(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockFetchLudwitt = jest.fn();
const mockGetClientId = jest.fn();
const mockGetClientSecret = jest.fn();

jest.mock("@/lib/ludwitt-config", () => ({
  LUDWITT_TOKEN_URL: "https://example.com/oauth/token",
  LUDWITT_TOKENS_COLLECTION: "ludwittTokens",
  fetchLudwittWithTimeout: (...a: unknown[]) => mockFetchLudwitt(...a),
  getLudwittClientId: () => mockGetClientId(),
  getLudwittClientSecret: () => mockGetClientSecret(),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => ({ __ts: "now" }),
    delete: () => ({ __delete: true }),
  },
}));

// crypto.randomBytes is deterministic per test by replacing the export
jest.mock("crypto", () => {
  const actual = jest.requireActual<typeof import("crypto")>("crypto");
  return {
    ...actual,
    randomBytes: jest.fn((n: number) => actual.randomBytes(n)),
  };
});

import {
  deleteLudwittTokens,
  getLudwittTokens,
  refreshLudwittTokens,
  saveLudwittTokens,
  withFreshLudwittAccessToken,
} from "@/lib/ludwitt-tokens";

function tsLikeMs(ms: number) {
  return {
    toMillis: () => ms,
    toDate: () => new Date(ms),
  };
}

function tokenSnap(data: Record<string, unknown> | null) {
  return {
    exists: !!data,
    data: () => data ?? undefined,
  };
}

describe("lib/ludwitt-tokens", () => {
  beforeEach(() => {
    adminDbMock.mockReset();
    mockFetchLudwitt.mockReset();
    mockGetClientId.mockReturnValue("CID");
    mockGetClientSecret.mockReturnValue("CS");
  });

  function fakeTokenDb(initialSnap: ReturnType<typeof tokenSnap>) {
    const update = jest.fn().mockResolvedValue(undefined);
    const set = jest.fn().mockResolvedValue(undefined);
    const deleteFn = jest.fn().mockResolvedValue(undefined);
    const get = jest.fn().mockResolvedValue(initialSnap);

    const doc = { get, set, update, delete: deleteFn };
    const collection = jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue(doc),
    });
    const runTransaction = jest.fn(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        get: jest.fn().mockResolvedValue(initialSnap),
        update: jest.fn(),
        set: jest.fn(),
      };
      return fn(tx);
    });
    return {
      db: { collection, runTransaction },
      doc,
      get,
      set,
      update,
      deleteFn,
    };
  }

  describe("getLudwittTokens", () => {
    it("returns null when admin db is unavailable", async () => {
      adminDbMock.mockReturnValueOnce(null);
      await expect(getLudwittTokens("u1")).rejects.toThrow("Firebase Admin not configured");
    });

    it("returns null when doc does not exist", async () => {
      const { db } = fakeTokenDb(tokenSnap(null));
      adminDbMock.mockReturnValueOnce(db);
      expect(await getLudwittTokens("u1")).toBeNull();
    });

    it("returns null when accessToken/refreshToken are missing", async () => {
      const { db } = fakeTokenDb(tokenSnap({}));
      adminDbMock.mockReturnValueOnce(db);
      expect(await getLudwittTokens("u1")).toBeNull();
    });

    it("returns the parsed tokens when doc has accessToken + refreshToken", async () => {
      const { db } = fakeTokenDb(
        tokenSnap({
          accessToken: "AT",
          refreshToken: "RT",
          scope: "read write",
          accessExpiresAt: tsLikeMs(1_700_000_000_000),
        }),
      );
      adminDbMock.mockReturnValueOnce(db);
      const out = await getLudwittTokens("u1");
      expect(out).toEqual({
        accessToken: "AT",
        refreshToken: "RT",
        scope: "read write",
        accessExpiresAt: new Date(1_700_000_000_000),
      });
    });

    it("defaults scope to '' and falls back to epoch 0 when timestamps missing", async () => {
      const { db } = fakeTokenDb(
        tokenSnap({ accessToken: "AT", refreshToken: "RT" }),
      );
      adminDbMock.mockReturnValueOnce(db);
      const out = await getLudwittTokens("u1");
      expect(out?.scope).toBe("");
      expect(out?.accessExpiresAt).toEqual(new Date(0));
    });
  });

  describe("saveLudwittTokens", () => {
    it("writes the raw token payload + computed accessExpiresAt", async () => {
      const { db, set } = fakeTokenDb(tokenSnap(null));
      adminDbMock.mockReturnValueOnce(db);
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValueOnce(now);
      await saveLudwittTokens("u1", {
        access_token: "AT",
        refresh_token: "RT",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "read",
      });
      const [payload, opts] = set.mock.calls[0];
      expect(payload).toMatchObject({
        accessToken: "AT",
        refreshToken: "RT",
        scope: "read",
        tokenType: "Bearer",
      });
      expect((payload.accessExpiresAt as Date).getTime()).toBe(now + 3600 * 1000);
      expect(opts).toEqual({ merge: true });
    });
  });

  describe("deleteLudwittTokens", () => {
    it("deletes the token doc", async () => {
      const { db, deleteFn } = fakeTokenDb(tokenSnap(null));
      adminDbMock.mockReturnValueOnce(db);
      await deleteLudwittTokens("u1");
      expect(deleteFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("refreshLudwittTokens", () => {
    it("throws ludwitt_tokens_missing when no doc exists", async () => {
      const initial = tokenSnap(null);
      const { db } = fakeTokenDb(initial);
      adminDbMock.mockReturnValueOnce(db);
      await expect(refreshLudwittTokens("u1")).rejects.toThrow("ludwitt_tokens_missing");
    });

    it("claims the lock, posts refresh, and writes new tokens", async () => {
      const initial = tokenSnap({
        accessToken: "AT0",
        refreshToken: "RT0",
        scope: "read",
        tokenType: "Bearer",
        accessExpiresAt: tsLikeMs(1_700_000_000_000),
      });

      const update = jest.fn().mockResolvedValue(undefined);
      const get = jest.fn().mockResolvedValue(initial);
      const docRef = { get, update };
      const collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      });
      const runTransaction = jest.fn(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          get: jest.fn().mockResolvedValue(initial),
          update: jest.fn(),
        };
        return fn(tx);
      });
      const db = { collection, runTransaction };
      adminDbMock.mockReturnValueOnce(db);

      mockFetchLudwitt.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "AT1",
          refresh_token: "RT1",
          expires_in: 7200,
          token_type: "Bearer",
          scope: "read write",
        }),
        text: async () => "",
      });

      const out = await refreshLudwittTokens("u1");
      expect(out.accessToken).toBe("AT1");
      expect(out.refreshToken).toBe("RT1");
      expect(out.scope).toBe("read write");
      expect(update).toHaveBeenCalled();
    });

    it("throws when refresh fails (non-2xx)", async () => {
      const initial = tokenSnap({
        accessToken: "AT0",
        refreshToken: "RT0",
        accessExpiresAt: tsLikeMs(0),
      });
      const update = jest.fn().mockResolvedValue(undefined);
      const get = jest.fn().mockResolvedValue(initial);
      const docRef = { get, update };
      const collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      });
      const runTransaction = jest.fn(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          get: jest.fn().mockResolvedValue(initial),
          update: jest.fn(),
        };
        return fn(tx);
      });
      const db = { collection, runTransaction };
      adminDbMock.mockReturnValueOnce(db);

      mockFetchLudwitt.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
        text: async () => "bad token",
      });

      await expect(refreshLudwittTokens("u1")).rejects.toThrow("refresh_failed:401");
      // Lock cleanup attempted
      expect(update).toHaveBeenCalled();
    });

    it("throws when client credentials aren't configured", async () => {
      mockGetClientId.mockReturnValueOnce("");
      const initial = tokenSnap({
        accessToken: "AT0",
        refreshToken: "RT0",
        accessExpiresAt: tsLikeMs(0),
      });
      const update = jest.fn().mockResolvedValue(undefined);
      const docRef = { get: jest.fn().mockResolvedValue(initial), update };
      const collection = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      });
      const runTransaction = jest.fn(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          get: jest.fn().mockResolvedValue(initial),
          update: jest.fn(),
        };
        return fn(tx);
      });
      const db = { collection, runTransaction };
      adminDbMock.mockReturnValueOnce(db);
      await expect(refreshLudwittTokens("u1")).rejects.toThrow("Ludwitt OAuth not configured");
    });
  });

  describe("withFreshLudwittAccessToken", () => {
    it("throws ludwitt_not_connected when no tokens stored", async () => {
      const { db } = fakeTokenDb(tokenSnap(null));
      adminDbMock.mockReturnValueOnce(db);
      await expect(
        withFreshLudwittAccessToken("u1", async () => ({
          status: 200,
          body: {},
          headers: new Headers(),
        })),
      ).rejects.toThrow("ludwitt_not_connected");
    });

    it("returns the first call result when status !== 401", async () => {
      const { db } = fakeTokenDb(
        tokenSnap({
          accessToken: "AT",
          refreshToken: "RT",
          scope: "",
          accessExpiresAt: tsLikeMs(0),
        }),
      );
      adminDbMock.mockReturnValueOnce(db);
      const call = jest.fn().mockResolvedValueOnce({
        status: 200,
        body: { ok: true },
        headers: new Headers(),
      });
      const out = await withFreshLudwittAccessToken("u1", call);
      expect(out.status).toBe(200);
      expect(call).toHaveBeenCalledTimes(1);
      expect(call).toHaveBeenCalledWith("AT");
    });

    it("retries the call after a 401, using the refreshed access token", async () => {
      // First, getLudwittTokens needs admin db
      const dbForGet = fakeTokenDb(
        tokenSnap({
          accessToken: "AT0",
          refreshToken: "RT0",
          scope: "",
          accessExpiresAt: tsLikeMs(0),
        }),
      );
      // refreshLudwittTokens also needs admin db (called second time)
      const initialForRefresh = tokenSnap({
        accessToken: "AT0",
        refreshToken: "RT0",
        accessExpiresAt: tsLikeMs(0),
      });
      const updateRefresh = jest.fn().mockResolvedValue(undefined);
      const docRefRefresh = {
        get: jest.fn().mockResolvedValue(initialForRefresh),
        update: updateRefresh,
      };
      const collRefresh = jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue(docRefRefresh),
      });
      const txnRefresh = jest.fn(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          get: jest.fn().mockResolvedValue(initialForRefresh),
          update: jest.fn(),
        };
        return fn(tx);
      });
      const dbRefresh = { collection: collRefresh, runTransaction: txnRefresh };

      adminDbMock
        .mockReturnValueOnce(dbForGet.db)
        .mockReturnValueOnce(dbRefresh);

      mockFetchLudwitt.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "AT1",
          refresh_token: "RT1",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "",
        }),
        text: async () => "",
      });

      const call = jest
        .fn()
        .mockResolvedValueOnce({
          status: 401,
          body: { err: "auth" },
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          status: 200,
          body: { ok: true },
          headers: new Headers(),
        });

      const out = await withFreshLudwittAccessToken("u1", call);
      expect(out.status).toBe(200);
      expect(call.mock.calls).toEqual([["AT0"], ["AT1"]]);
    });
  });
});
