/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/events/[eventId]/coworking/slots/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getSessionsWithStatus } from "@/lib/coworking";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true })),
  getClientIdentifier: () => "test-client",
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/coworking", () => ({
  getSessionsWithStatus: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;

const mockGetSessionsWithStatus = getSessionsWithStatus as jest.MockedFunction<
  typeof getSessionsWithStatus
>;

const { checkRateLimit } = jest.requireMock("@/lib/rate-limit") as {
  checkRateLimit: jest.Mock;
};

function makeContext(eventId: string) {
  return { params: Promise.resolve({ eventId }) };
}

function makeRequest() {
  return new NextRequest("http://localhost/api/events/test-event/coworking/slots");
}

describe("GET /api/events/[eventId]/coworking/slots", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkRateLimit.mockReturnValue({ success: true });
  });

  it("returns 429 when rate limited", async () => {
    checkRateLimit.mockReturnValue({ success: false, retryAfter: 30 });

    const res = await GET(makeRequest(), makeContext("test-event"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(body.retryAfterSeconds).toBe(30);
  });

  it("returns 400 for invalid event ID", async () => {
    const res = await GET(makeRequest(), makeContext("../invalid!@#"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid event ID");
  });

  it("returns 400 for empty event ID", async () => {
    const res = await GET(makeRequest(), makeContext(""));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid event ID");
  });

  it("returns sessions for unauthenticated user", async () => {
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));
    const mockSessions = [
      { id: "s1", title: "Morning Session", spotsLeft: 5 },
      { id: "s2", title: "Afternoon Session", spotsLeft: 0 },
    ];
    mockGetSessionsWithStatus.mockResolvedValue(mockSessions as never);

    const res = await GET(makeRequest(), makeContext("test-event"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.eventId).toBe("test-event");
    expect(body.sessions).toEqual(mockSessions);
    expect(mockGetSessionsWithStatus).toHaveBeenCalledWith("test-event", undefined);
  });

  it("returns sessions with user status for authenticated user", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    const mockSessions = [
      { id: "s1", title: "Morning", registered: true },
    ];
    mockGetSessionsWithStatus.mockResolvedValue(mockSessions as never);

    const res = await GET(makeRequest(), makeContext("test-event"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sessions).toEqual(mockSessions);
    expect(mockGetSessionsWithStatus).toHaveBeenCalledWith("test-event", "u1");
  });

  it("returns 500 when getSessionsWithStatus throws", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    mockGetSessionsWithStatus.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest(), makeContext("test-event"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to get coworking slots");
  });
});
