/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #30 — Hack-a-Sprint 2026 credit-email POST.
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/hackathons/showcase/hack-a-sprint-2026/credit-email/route";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { resolveHackASprint2026CreditForUser } from "@/lib/hackathon-asprint-2026-credit-eligibility";
import { sendEmail } from "@/lib/mailgun";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
  getAdminAuth: jest.fn(),
}));
jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/hackathon-asprint-2026-credit-eligibility", () => ({
  resolveHackASprint2026CreditForUser: jest.fn(),
}));
jest.mock("@/lib/mailgun", () => ({
  sendEmail: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  ...jest.requireActual("@/lib/rate-limit"),
  getClientIdentifier: jest.fn(() => "client-1"),
}));
jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "TS") },
}));

const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockAuth = getAdminAuth as jest.MockedFunction<typeof getAdminAuth>;
const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockResolve = resolveHackASprint2026CreditForUser as jest.MockedFunction<
  typeof resolveHackASprint2026CreditForUser
>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockRate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

function makeReq() {
  return new NextRequest(
    "https://example.com/api/hackathons/showcase/hack-a-sprint-2026/credit-email",
    { method: "POST" },
  );
}

interface DbOpts {
  userDoc?: { exists: boolean; data?: Record<string, unknown> };
  userSetThrows?: boolean;
  authEmail?: string | null;
}

function setupAdmins(opts: DbOpts = {}) {
  const userGet = jest.fn().mockResolvedValue({
    exists: opts.userDoc?.exists ?? true,
    data: () => opts.userDoc?.data ?? { displayName: "Alice" },
  });
  const userSet = jest.fn();
  if (opts.userSetThrows) {
    userSet.mockRejectedValue(new Error("write conflict"));
  } else {
    userSet.mockResolvedValue(undefined);
  }
  const userRef = { get: userGet, set: userSet };
  mockDb.mockReturnValue({
    collection: jest.fn(() => ({ doc: jest.fn(() => userRef) })),
  } as never);
  const authEmail = "authEmail" in opts ? opts.authEmail : "user@example.com";
  mockAuth.mockReturnValue({
    getUser: jest.fn().mockResolvedValue({ email: authEmail }),
  } as never);
  return { userGet, userSet };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockResolvedValue({ success: true } as never);
  mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
  mockResolve.mockResolvedValue({
    ok: true,
    creditUrl: "https://cursor.com/credit/xyz",
  } as never);
  mockSendEmail.mockResolvedValue(undefined as never);
});

describe("POST /api/hackathons/showcase/hack-a-sprint-2026/credit-email", () => {
  it("returns 429 when client rate limit denied", async () => {
    mockRate.mockResolvedValueOnce({ success: false, retryAfter: 30 } as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.retryAfterSeconds).toBe(30);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 500 when admin db is null", async () => {
    mockDb.mockReturnValue(null as never);
    mockAuth.mockReturnValue({ getUser: jest.fn() } as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });

  it("returns 500 when admin auth is null", async () => {
    mockDb.mockReturnValue({ collection: jest.fn() } as never);
    mockAuth.mockReturnValue(null as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });

  it("returns 429 when per-uid rate limit denies", async () => {
    setupAdmins();
    mockRate
      .mockResolvedValueOnce({ success: true } as never)
      .mockResolvedValueOnce({ success: false, retryAfter: 10 } as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
  });

  it("returns 400 with reason when resolveCredit returns ok=false", async () => {
    setupAdmins();
    mockResolve.mockResolvedValueOnce({ ok: false, reason: "no-team" } as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ ok: false, reason: "no-team" });
  });

  it("returns ok=true alreadySent when email previously sent", async () => {
    const { userSet } = setupAdmins({
      userDoc: {
        exists: true,
        data: { displayName: "Alice", hackASprint2026CreditEmailSentAt: { __ts: "earlier" } },
      },
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      alreadySent: true,
      message: "Credit link was already emailed to you.",
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(userSet).not.toHaveBeenCalled();
  });

  it("returns 400 when auth has no email on the account", async () => {
    setupAdmins({ authEmail: null });
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No email");
  });

  it("returns 400 when auth email is whitespace-only", async () => {
    setupAdmins({ authEmail: "   " });
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
  });

  it("falls back to 'there' when displayName is missing", async () => {
    setupAdmins({ userDoc: { exists: true, data: {} } });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        text: expect.stringContaining("Hi there"),
      }),
    );
  });

  it("falls back to 'there' when displayName is non-string", async () => {
    setupAdmins({ userDoc: { exists: true, data: { displayName: 42 } } });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("Hi there") }),
    );
  });

  it("happy path: sends email and writes sentAt timestamp", async () => {
    const { userSet } = setupAdmins({
      userDoc: { exists: true, data: { displayName: "Alice" } },
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, emailedTo: "user@example.com" });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: expect.stringContaining("Cursor credit link"),
        text: expect.stringContaining("Hi Alice"),
        html: expect.stringContaining("https://cursor.com/credit/xyz"),
      }),
    );
    expect(userSet).toHaveBeenCalledWith(
      expect.objectContaining({
        hackASprint2026CreditEmailSentAt: "TS",
        updatedAt: "TS",
      }),
      { merge: true },
    );
  });

  it("returns 500 when sendEmail throws", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    setupAdmins();
    mockSendEmail.mockRejectedValueOnce(new Error("mailgun 5xx"));
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to send email");
    consoleErrorSpy.mockRestore();
  });
});
