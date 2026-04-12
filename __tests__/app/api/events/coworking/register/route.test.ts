/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST, DELETE } from "@/app/api/events/[eventId]/coworking/register/route";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  checkCoworkingEligibility,
  getUserProfileForRegistration,
  registerForSession,
  cancelRegistration,
} from "@/lib/coworking";

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
  checkCoworkingEligibility: jest.fn(),
  getUserProfileForRegistration: jest.fn(),
  registerForSession: jest.fn(),
  cancelRegistration: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockCheckEligibility = checkCoworkingEligibility as jest.MockedFunction<typeof checkCoworkingEligibility>;
const mockGetProfile = getUserProfileForRegistration as jest.MockedFunction<typeof getUserProfileForRegistration>;
const mockRegister = registerForSession as jest.MockedFunction<typeof registerForSession>;
const mockCancelRegistration = cancelRegistration as jest.MockedFunction<typeof cancelRegistration>;

const { checkRateLimit } = jest.requireMock("@/lib/rate-limit") as {
  checkRateLimit: jest.Mock;
};

function makeContext(eventId: string) {
  return { params: Promise.resolve({ eventId }) };
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/events/test-event/coworking/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest() {
  return new NextRequest("http://localhost/api/events/test-event/coworking/register", {
    method: "DELETE",
  });
}

describe("POST /api/events/[eventId]/coworking/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkRateLimit.mockReturnValue({ success: true });
  });

  it("returns 429 when rate limited", async () => {
    checkRateLimit.mockReturnValue({ success: false, retryAfter: 30 });

    const res = await POST(makePostRequest({ sessionId: "s1" }), makeContext("test-event"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);

    const res = await POST(makePostRequest({ sessionId: "s1" }), makeContext("test-event"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid event ID", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    mockCheckEligibility.mockResolvedValue({ eligible: true } as never);

    const res = await POST(makePostRequest({ sessionId: "s1" }), makeContext("../bad!"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid event ID");
  });

  it("returns 400 when user is not eligible", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    mockCheckEligibility.mockResolvedValue({ eligible: false, reason: "Not checked in" } as never);

    const res = await POST(makePostRequest({ sessionId: "s1" }), makeContext("test-event"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Not checked in");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    mockCheckEligibility.mockResolvedValue({ eligible: true } as never);

    const req = new NextRequest("http://localhost/api/events/test-event/coworking/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const res = await POST(req, makeContext("test-event"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON in request body");
  });

  it("returns 400 when sessionId is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    mockCheckEligibility.mockResolvedValue({ eligible: true } as never);

    const res = await POST(makePostRequest({}), makeContext("test-event"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Session ID is required");
  });

  it("returns 400 when sessionId is empty string", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    mockCheckEligibility.mockResolvedValue({ eligible: true } as never);

    const res = await POST(makePostRequest({ sessionId: "" }), makeContext("test-event"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Session ID is required");
  });

  it("returns 400 when profile cannot be loaded", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    mockCheckEligibility.mockResolvedValue({ eligible: true } as never);
    mockGetProfile.mockResolvedValue(null as never);

    const res = await POST(makePostRequest({ sessionId: "s1" }), makeContext("test-event"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Could not load your profile");
  });

  it("returns 400 when registration fails", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    mockCheckEligibility.mockResolvedValue({ eligible: true } as never);
    const mockProfile = { name: "Test User", email: "test@example.com" };
    mockGetProfile.mockResolvedValue(mockProfile as never);
    mockRegister.mockResolvedValue({ success: false, error: "Session is full" } as never);

    const res = await POST(makePostRequest({ sessionId: "s1" }), makeContext("test-event"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Session is full");
  });

  it("returns 200 on successful registration", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    mockCheckEligibility.mockResolvedValue({ eligible: true } as never);
    const mockProfile = { name: "Test User", email: "test@example.com" };
    mockGetProfile.mockResolvedValue(mockProfile as never);
    const mockRegistration = { id: "reg1", sessionId: "s1", userId: "u1" };
    mockRegister.mockResolvedValue({ success: true, registration: mockRegistration } as never);

    const res = await POST(makePostRequest({ sessionId: "s1" }), makeContext("test-event"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe("Successfully registered for coworking session!");
    expect(body.registration).toEqual(mockRegistration);
    expect(mockRegister).toHaveBeenCalledWith("test-event", "s1", "u1", mockProfile);
  });

  it("returns 500 on unexpected error", async () => {
    mockGetVerifiedUser.mockRejectedValue(new Error("unexpected"));

    const res = await POST(makePostRequest({ sessionId: "s1" }), makeContext("test-event"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to register");
  });
});

describe("DELETE /api/events/[eventId]/coworking/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkRateLimit.mockReturnValue({ success: true });
  });

  it("returns 429 when rate limited", async () => {
    checkRateLimit.mockReturnValue({ success: false, retryAfter: 30 });

    const res = await DELETE(makeDeleteRequest(), makeContext("test-event"));
    expect(res.status).toBe(429);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);

    const res = await DELETE(makeDeleteRequest(), makeContext("test-event"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid event ID", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });

    const res = await DELETE(makeDeleteRequest(), makeContext("../bad!"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid event ID");
  });

  it("returns 400 when cancellation fails", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    mockCancelRegistration.mockResolvedValue({ success: false, error: "No registration found" } as never);

    const res = await DELETE(makeDeleteRequest(), makeContext("test-event"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No registration found");
  });

  it("returns 200 on successful cancellation", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    mockCancelRegistration.mockResolvedValue({ success: true } as never);

    const res = await DELETE(makeDeleteRequest(), makeContext("test-event"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe("Registration cancelled successfully");
    expect(mockCancelRegistration).toHaveBeenCalledWith("test-event", "u1");
  });

  it("returns 500 on unexpected error", async () => {
    mockGetVerifiedUser.mockRejectedValue(new Error("unexpected"));

    const res = await DELETE(makeDeleteRequest(), makeContext("test-event"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to cancel registration");
  });
});
