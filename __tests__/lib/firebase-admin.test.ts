/**
 * @jest-environment node
 */
const mockCert = jest.fn();
const mockGetApps = jest.fn();
const mockInitializeApp = jest.fn();
const mockGetAuth = jest.fn();
const mockGetDatabase = jest.fn();
const mockGetFirestore = jest.fn();

jest.mock("firebase-admin/app", () => ({
  cert: (...a: unknown[]) => mockCert(...a),
  getApps: () => mockGetApps(),
  initializeApp: (...a: unknown[]) => mockInitializeApp(...a),
}));

jest.mock("firebase-admin/auth", () => ({
  getAuth: (...a: unknown[]) => mockGetAuth(...a),
}));

jest.mock("firebase-admin/database", () => ({
  getDatabase: (...a: unknown[]) => mockGetDatabase(...a),
}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: (...a: unknown[]) => mockGetFirestore(...a),
}));

const ORIGINAL_ENV = { ...process.env };

async function loadFresh() {
  let mod: typeof import("@/lib/firebase-admin");
  await jest.isolateModulesAsync(async () => {
    mod = await import("@/lib/firebase-admin");
  });
  return mod!;
}

describe("lib/firebase-admin", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockCert.mockReset();
    mockGetApps.mockReset();
    mockInitializeApp.mockReset();
    mockGetAuth.mockReset();
    mockGetDatabase.mockReset();
    mockGetFirestore.mockReset();
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.FIREBASE_DATABASE_URL;
    delete process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe("getAdminDb", () => {
    it("returns null when no credentials are configured", async () => {
      mockGetApps.mockReturnValue([]);
      const { getAdminDb } = await loadFresh();
      expect(getAdminDb()).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("No credentials found"),
      );
    });

    it("initializes with a service-account JSON and returns the Firestore instance", async () => {
      const fakeApp = { name: "fake-app" };
      const fakeFirestore = {
        settings: jest.fn(),
      } as unknown as ReturnType<typeof mockGetFirestore>;
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
        project_id: "demo-project",
        client_email: "x@y",
        private_key: "k",
      });
      mockGetApps.mockReturnValue([]);
      mockInitializeApp.mockReturnValue(fakeApp);
      mockGetFirestore.mockReturnValue(fakeFirestore);
      mockCert.mockReturnValue("cert-handle");

      const { getAdminDb } = await loadFresh();
      const db = getAdminDb();
      expect(db).toBe(fakeFirestore);
      expect(mockCert).toHaveBeenCalledWith({
        project_id: "demo-project",
        client_email: "x@y",
        private_key: "k",
      });
      expect(mockInitializeApp).toHaveBeenCalledWith({
        credential: "cert-handle",
        projectId: "demo-project",
        databaseURL: undefined,
      });
      expect(
        (fakeFirestore as unknown as { settings: jest.Mock }).settings,
      ).toHaveBeenCalledWith({ ignoreUndefinedProperties: true });
    });

    it("initializes with GOOGLE_APPLICATION_CREDENTIALS when service-account JSON is unset", async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/sa.json";
      process.env.FIREBASE_DATABASE_URL = "https://demo.firebaseio.com";
      mockGetApps.mockReturnValue([]);
      mockInitializeApp.mockReturnValue({});
      mockGetFirestore.mockReturnValue({ settings: jest.fn() });
      const { getAdminDb } = await loadFresh();
      getAdminDb();
      expect(mockInitializeApp).toHaveBeenCalledWith({
        databaseURL: "https://demo.firebaseio.com",
      });
    });

    it("falls back to NEXT_PUBLIC_FIREBASE_DATABASE_URL when FIREBASE_DATABASE_URL is unset", async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/sa.json";
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL =
        "https://demo-public.firebaseio.com";
      mockGetApps.mockReturnValue([]);
      mockInitializeApp.mockReturnValue({});
      mockGetFirestore.mockReturnValue({ settings: jest.fn() });
      const { getAdminDb } = await loadFresh();
      getAdminDb();
      expect(mockInitializeApp).toHaveBeenCalledWith({
        databaseURL: "https://demo-public.firebaseio.com",
      });
    });

    it("reuses an existing initialized app from getApps()", async () => {
      const existingApp = { name: "existing" };
      mockGetApps.mockReturnValue([existingApp]);
      mockGetFirestore.mockReturnValue({ settings: jest.fn() });
      const { getAdminDb } = await loadFresh();
      getAdminDb();
      expect(mockInitializeApp).not.toHaveBeenCalled();
      expect(mockGetFirestore).toHaveBeenCalledWith(existingApp);
    });

    it("caches the Firestore instance across calls", async () => {
      mockGetApps.mockReturnValue([{ name: "a" }]);
      mockGetFirestore.mockReturnValue({ settings: jest.fn() });
      const { getAdminDb } = await loadFresh();
      const a = getAdminDb();
      const b = getAdminDb();
      expect(a).toBe(b);
      expect(mockGetFirestore).toHaveBeenCalledTimes(1);
    });

    it("swallows errors from db.settings() when it has already been applied", async () => {
      mockGetApps.mockReturnValue([{ name: "a" }]);
      const throwing = {
        settings: jest.fn(() => {
          throw new Error("settings already applied");
        }),
      };
      mockGetFirestore.mockReturnValue(throwing);
      const { getAdminDb } = await loadFresh();
      const db = getAdminDb();
      expect(db).toBe(throwing);
    });

    it("throws a helpful error when FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON", async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "{not-json";
      mockGetApps.mockReturnValue([]);
      const { getAdminDb } = await loadFresh();
      expect(() => getAdminDb()).toThrow(
        "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON",
      );
    });
  });

  describe("getAdminAuth", () => {
    it("returns null when no credentials are configured", async () => {
      mockGetApps.mockReturnValue([]);
      const { getAdminAuth } = await loadFresh();
      expect(getAdminAuth()).toBeNull();
    });

    it("returns the Auth instance when an app is initialized", async () => {
      mockGetApps.mockReturnValue([{ name: "a" }]);
      const fakeAuth = { __auth: 1 };
      mockGetAuth.mockReturnValue(fakeAuth);
      const { getAdminAuth } = await loadFresh();
      expect(getAdminAuth()).toBe(fakeAuth);
    });

    it("caches the Auth instance across calls", async () => {
      mockGetApps.mockReturnValue([{ name: "a" }]);
      mockGetAuth.mockReturnValue({ __auth: 1 });
      const { getAdminAuth } = await loadFresh();
      getAdminAuth();
      getAdminAuth();
      expect(mockGetAuth).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAdminRtdb", () => {
    it("returns null when no credentials are configured", async () => {
      mockGetApps.mockReturnValue([]);
      const { getAdminRtdb } = await loadFresh();
      expect(getAdminRtdb()).toBeNull();
    });

    it("returns the Database instance when an app is initialized", async () => {
      mockGetApps.mockReturnValue([{ name: "a" }]);
      const fakeDb = { __rtdb: 1 };
      mockGetDatabase.mockReturnValue(fakeDb);
      const { getAdminRtdb } = await loadFresh();
      expect(getAdminRtdb()).toBe(fakeDb);
    });

    it("caches the Database instance across calls", async () => {
      mockGetApps.mockReturnValue([{ name: "a" }]);
      mockGetDatabase.mockReturnValue({ __rtdb: 1 });
      const { getAdminRtdb } = await loadFresh();
      getAdminRtdb();
      getAdminRtdb();
      expect(mockGetDatabase).toHaveBeenCalledTimes(1);
    });
  });
});
