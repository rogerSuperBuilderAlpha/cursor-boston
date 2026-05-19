/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #13 — cursor disconnect route.
 */
import { POST } from "@/app/api/cursor/disconnect/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_config: unknown, handler: (req: unknown) => unknown) => handler,
  rateLimitConfigs: { oauthCallback: {} },
}));
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { delete: jest.fn(() => "DELETE_FIELD") },
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

function fakeDb(behavior: { setOk?: boolean; deleteOk?: boolean } = {}) {
  const setSpy = jest.fn().mockImplementation(() =>
    behavior.setOk === false ? Promise.reject(new Error("set fail")) : Promise.resolve(),
  );
  const deleteSpy = jest.fn().mockImplementation(() =>
    behavior.deleteOk === false ? Promise.reject(new Error("delete fail")) : Promise.resolve(),
  );
  const userDocChain = {
    set: setSpy,
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({ delete: deleteSpy })),
    })),
  };
  return {
    spies: { setSpy, deleteSpy },
    db: {
      collection: jest.fn(() => ({
        doc: jest.fn(() => userDocChain),
      })),
    } as never,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/cursor/disconnect", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const { status, body } = await readJson(
      await POST(makeRequest({ method: "POST", path: "/api/cursor/disconnect" })),
    );
    expect(status).toBe(401);
    expect(body.error).toBe("unauthenticated");
  });

  it("returns 500 when admin db is not configured", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    mockDb.mockReturnValue(null as never);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/cursor/disconnect" })),
    );
    expect(status).toBe(500);
    expect(body.error).toBe("not_configured");
  });

  it("deletes cursor field + secrets doc on success", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const { db, spies } = fakeDb();
    mockDb.mockReturnValue(db);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/cursor/disconnect" })),
    );
    expect(status).toBe(200);
    expect(body.disconnected).toBe(true);
    expect(spies.setSpy).toHaveBeenCalledWith(
      { cursor: "DELETE_FIELD" },
      { merge: true },
    );
    expect(spies.deleteSpy).toHaveBeenCalled();
  });

  it("returns 500 disconnect_failed when set throws", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const { db } = fakeDb({ setOk: false });
    mockDb.mockReturnValue(db);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/cursor/disconnect" })),
    );
    expect(status).toBe(500);
    expect(body.error).toBe("disconnect_failed");
  });

  it("returns 500 disconnect_failed when delete throws", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const { db } = fakeDb({ deleteOk: false });
    mockDb.mockReturnValue(db);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/cursor/disconnect" })),
    );
    expect(status).toBe(500);
    expect(body.error).toBe("disconnect_failed");
  });
});
