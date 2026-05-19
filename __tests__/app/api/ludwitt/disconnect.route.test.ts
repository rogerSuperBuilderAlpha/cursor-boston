/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #13 — ludwitt disconnect route.
 */
import { POST } from "@/app/api/ludwitt/disconnect/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { deleteLudwittTokens } from "@/lib/ludwitt-tokens";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_config: unknown, handler: (req: unknown) => unknown) => handler,
  rateLimitConfigs: { standard: {} },
}));
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/ludwitt-tokens", () => ({ deleteLudwittTokens: jest.fn() }));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { delete: jest.fn(() => "DELETE_FIELD") },
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockDeleteTokens = deleteLudwittTokens as jest.MockedFunction<typeof deleteLudwittTokens>;

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteTokens.mockResolvedValue(undefined);
});

describe("POST /api/ludwitt/disconnect", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const { status, body } = await readJson(
      await POST(makeRequest({ method: "POST", path: "/api/ludwitt/disconnect" })),
    );
    expect(status).toBe(401);
    expect(body.error).toBe("unauthenticated");
  });

  it("returns 500 when admin db is not configured", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    mockDb.mockReturnValue(null as never);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/ludwitt/disconnect" })),
    );
    expect(status).toBe(500);
    expect(body.error).toBe("not_configured");
  });

  it("deletes tokens + ludwitt field on success", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const setSpy = jest.fn().mockResolvedValue(undefined);
    mockDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ set: setSpy })),
      })),
    } as never);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/ludwitt/disconnect" })),
    );
    expect(status).toBe(200);
    expect(body.disconnected).toBe(true);
    expect(mockDeleteTokens).toHaveBeenCalledWith("u1");
    expect(setSpy).toHaveBeenCalledWith(
      { ludwitt: "DELETE_FIELD" },
      { merge: true },
    );
  });

  it("returns 500 disconnect_failed when deleteLudwittTokens throws", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    mockDb.mockReturnValue({ collection: jest.fn() } as never);
    mockDeleteTokens.mockRejectedValue(new Error("ouch"));
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/ludwitt/disconnect" })),
    );
    expect(status).toBe(500);
    expect(body.error).toBe("disconnect_failed");
  });

  it("returns 500 disconnect_failed when set throws", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const setSpy = jest.fn().mockRejectedValue(new Error("set fail"));
    mockDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ set: setSpy })),
      })),
    } as never);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/ludwitt/disconnect" })),
    );
    expect(status).toBe(500);
    expect(body.error).toBe("disconnect_failed");
  });
});
