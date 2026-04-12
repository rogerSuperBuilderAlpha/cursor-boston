/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/hackathons/events/[eventId]/checkin/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return {
    ...actual,
    getClientIdentifier: jest.fn(() => "test-ip"),
    checkRateLimit: jest.fn(() => ({ success: true, retryAfter: 0 })),
  };
});

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

const VALID_EVENT_ID = "hack-a-sprint-2026";

function makeContext(eventId: string) {
  return { params: Promise.resolve({ eventId }) };
}

function makeRequest(body?: unknown) {
  const opts: RequestInit = { method: "POST" };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  return new NextRequest("http://localhost/api/hackathons/events/test/checkin", opts);
}

function makeMockDoc(data: Record<string, unknown> | null) {
  return {
    exists: data !== null,
    id: "doc-id",
    data: () => data,
  };
}

describe("POST /api/hackathons/events/[eventId]/checkin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const req = makeRequest({ userId: "u1", checkedIn: true });
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(403);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", isAdmin: false });
    const req = makeRequest({ userId: "u1", checkedIn: true });
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(403);
  });

  it("returns 404 for unknown event ID", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin", email: "a@test.com", isAdmin: true });
    const req = makeRequest({ userId: "u1", checkedIn: true });
    const res = await POST(req, makeContext("bad-event"));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Unknown event");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin", email: "a@test.com", isAdmin: true });
    const req = new NextRequest("http://localhost/api/hackathons/events/test/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON");
  });

  it("returns 400 when userId is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin", email: "a@test.com", isAdmin: true });
    mockGetAdminDb.mockReturnValue({} as never);
    const req = makeRequest({ checkedIn: true });
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("userId required");
  });

  it("returns 500 when db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin", email: "a@test.com", isAdmin: true });
    mockGetAdminDb.mockReturnValue(null as never);
    const req = makeRequest({ userId: "u1", checkedIn: true });
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(500);
  });

  it("checks in an existing signup", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin", email: "a@test.com", isAdmin: true });

    const updateMock = jest.fn().mockResolvedValue(undefined);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => makeMockDoc({ eventId: VALID_EVENT_ID, userId: "u1" })),
          update: updateMock,
        })),
      })),
    } as never);

    const req = makeRequest({ userId: "u1", checkedIn: true });
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.checkedIn).toBe(true);
    expect(updateMock).toHaveBeenCalled();
  });

  it("unchecks in an existing signup when checkedIn is false", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin", email: "a@test.com", isAdmin: true });

    const updateMock = jest.fn().mockResolvedValue(undefined);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => makeMockDoc({ eventId: VALID_EVENT_ID, userId: "u1" })),
          update: updateMock,
        })),
      })),
    } as never);

    const req = makeRequest({ userId: "u1", checkedIn: false });
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.checkedIn).toBe(false);
    expect(updateMock).toHaveBeenCalled();
  });

  it("returns 404 when signup does not exist and checkedIn is false", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin", email: "a@test.com", isAdmin: true });

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => makeMockDoc(null)),
        })),
      })),
    } as never);

    const req = makeRequest({ userId: "u1", checkedIn: false });
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("User is not signed up for this event");
  });

  it("creates signup doc for walk-in when user exists", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin", email: "a@test.com", isAdmin: true });

    const setMock = jest.fn().mockResolvedValue(undefined);
    const userDoc = makeMockDoc({ displayName: "Walk In User" });

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => ({
        doc: jest.fn(() => {
          if (name === "users") return { get: jest.fn(async () => userDoc) };
          return {
            get: jest.fn(async () => makeMockDoc(null)),
            set: setMock,
          };
        }),
      })),
    } as never);

    const req = makeRequest({ userId: "walk-in-user", checkedIn: true });
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.checkedIn).toBe(true);
    expect(json.created).toBe(true);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: VALID_EVENT_ID,
        userId: "walk-in-user",
      })
    );
  });

  it("returns 404 when walk-in user does not have an account", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin", email: "a@test.com", isAdmin: true });

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => ({
        doc: jest.fn(() => {
          if (name === "users") return { get: jest.fn(async () => makeMockDoc(null)) };
          return { get: jest.fn(async () => makeMockDoc(null)) };
        }),
      })),
    } as never);

    const req = makeRequest({ userId: "no-account", checkedIn: true });
    const res = await POST(req, makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("cursorboston.com account");
  });
});
