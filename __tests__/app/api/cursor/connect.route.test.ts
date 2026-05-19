/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #60 — cursor connect POST route.
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/cursor/connect/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  validateCursorApiKey,
  InvalidCursorKeyError,
} from "@/lib/cursor/validate";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/cursor/validate", () => {
  const actual = jest.requireActual("@/lib/cursor/validate");
  return {
    ...actual,
    validateCursorApiKey: jest.fn(),
  };
});
jest.mock("@/lib/cursor/encryption", () => ({
  encryptApiKey: jest.fn((key: string) => `ENC(${key})`),
  fingerprintApiKey: jest.fn((key: string) => `FP(${key})`),
}));
jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_: unknown, handler: (req: unknown) => unknown) => handler,
  rateLimitConfigs: { oauthCallback: {} },
}));
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "TS") },
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockValidate = validateCursorApiKey as jest.MockedFunction<typeof validateCursorApiKey>;

const VALID_BODY = { apiKey: "key_abc123_long_enough", monthlyCapUsd: 25 };

function makeReq(body: unknown = VALID_BODY) {
  return new NextRequest("https://example.com/api/cursor/connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function setupDb() {
  const userSet = jest.fn().mockResolvedValue(undefined);
  const secretSet = jest.fn().mockResolvedValue(undefined);
  mockDb.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: userSet,
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({ set: secretSet })),
        })),
      })),
    })),
  } as never);
  return { userSet, secretSet };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.mockResolvedValue({ uid: "u1" } as never);
  mockValidate.mockResolvedValue({
    modelsAvailable: ["claude-sonnet"],
    defaultModel: "claude-sonnet",
  } as never);
});

describe("POST /api/cursor/connect", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 500 when admin db is null", async () => {
    mockDb.mockReturnValue(null as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("not_configured");
  });

  it("returns 400 when body is not valid JSON", async () => {
    setupDb();
    const res = await POST(makeReq("not-json"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_body");
  });

  it("returns 400 when zod schema rejects body", async () => {
    setupDb();
    const res = await POST(makeReq({ apiKey: 123 /* number not string */ }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when apiKey is whitespace-only", async () => {
    setupDb();
    const res = await POST(makeReq({ ...VALID_BODY, apiKey: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when monthlyCapUsd is not in [0, 5, 25, 100]", async () => {
    setupDb();
    const res = await POST(makeReq({ ...VALID_BODY, monthlyCapUsd: 50 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when monthlyCapUsd is not a number", async () => {
    setupDb();
    const res = await POST(makeReq({ ...VALID_BODY, monthlyCapUsd: "25" }));
    expect(res.status).toBe(400);
  });

  it("accepts 0, 5, 25, 100 as valid monthlyCapUsd", async () => {
    for (const cap of [0, 5, 25, 100]) {
      setupDb();
      const res = await POST(makeReq({ ...VALID_BODY, monthlyCapUsd: cap }));
      expect(res.status).toBe(200);
    }
  });

  it("returns 400 'invalid_key' when validateCursorApiKey throws InvalidCursorKeyError", async () => {
    setupDb();
    mockValidate.mockRejectedValueOnce(new InvalidCursorKeyError("bad key"));
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_key");
  });

  it("returns 500 'connect_failed' on unknown validation error", async () => {
    setupDb();
    mockValidate.mockRejectedValueOnce(new Error("network down"));
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("connect_failed");
  });

  it("writes user.cursor doc and secret on happy path, returns fingerprint", async () => {
    const { userSet, secretSet } = setupDb();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.fingerprint).toBe("FP(key_abc123_long_enough)");
    expect(body.defaultModel).toBe("claude-sonnet");
    expect(userSet).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: expect.objectContaining({
          apiKeyFingerprint: "FP(key_abc123_long_enough)",
          monthlyCapUsd: 25,
          defaultModel: "claude-sonnet",
          modelsAvailable: ["claude-sonnet"],
          connectedAt: "TS",
        }),
      }),
      { merge: true },
    );
    expect(secretSet).toHaveBeenCalledWith({
      apiKeyEncrypted: "ENC(key_abc123_long_enough)",
      rotatedAt: "TS",
    });
  });

  it("trims whitespace from apiKey before validation", async () => {
    setupDb();
    await POST(makeReq({ apiKey: "  key_trimmed  ", monthlyCapUsd: 5 }));
    expect(mockValidate).toHaveBeenCalledWith("key_trimmed");
  });
});
