/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/live/[sessionId]/queue/route";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  enqueueSpeakerServer,
  LiveSessionClosedError,
  LiveSessionDuplicateSpeakerError,
  LiveSessionNotFoundError,
} from "@/lib/live-sessions/data-server";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/live-sessions/data-server", () => ({
  enqueueSpeakerServer: jest.fn(),
  LiveSessionNotFoundError: class LiveSessionNotFoundError extends Error {},
  LiveSessionClosedError: class LiveSessionClosedError extends Error {},
  LiveSessionDuplicateSpeakerError: class LiveSessionDuplicateSpeakerError extends Error {},
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockEnqueueSpeakerServer =
  enqueueSpeakerServer as jest.MockedFunction<typeof enqueueSpeakerServer>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/live/session-1/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/live/[sessionId]/queue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires authentication", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);

    const res = await POST(makeRequest({ talkTitle: "Demo", durationMinutes: 3 }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });

    expect(res.status).toBe(401);
  });

  it("validates talk title and duration", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "user-1",
      email: "user@example.com",
    });

    const res = await POST(makeRequest({ talkTitle: "", durationMinutes: 9 }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });

    expect(res.status).toBe(400);
    expect(mockEnqueueSpeakerServer).not.toHaveBeenCalled();
  });

  it("enqueues a speaker", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "user-1",
      email: "user@example.com",
      name: "Queue User",
      picture: "https://example.com/avatar.png",
    });
    mockEnqueueSpeakerServer.mockResolvedValue({
      id: "entry-1",
      sessionId: "session-1",
      userId: "user-1",
      speakerName: "Queue User",
      speakerPhotoUrl: "https://example.com/avatar.png",
      talkTitle: "Building Fast",
      durationMinutes: 5,
      status: "queued",
      createdAtMs: 1,
      updatedAtMs: 1,
    });

    const res = await POST(makeRequest({ talkTitle: " Building Fast ", durationMinutes: 5 }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockEnqueueSpeakerServer).toHaveBeenCalledWith({
      sessionId: "session-1",
      userId: "user-1",
      speakerName: "Queue User",
      speakerPhotoUrl: "https://example.com/avatar.png",
      talkTitle: "Building Fast",
      durationMinutes: 5,
    });
    expect(body).toEqual({
      entryId: "entry-1",
      sessionId: "session-1",
      talkTitle: "Building Fast",
      durationMinutes: 5,
      status: "queued",
    });
  });

  it("maps live-session domain errors to HTTP statuses", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "user-1",
      email: "user@example.com",
    });
    mockEnqueueSpeakerServer.mockRejectedValueOnce(new LiveSessionNotFoundError());

    const notFoundRes = await POST(makeRequest({ talkTitle: "Demo", durationMinutes: 3 }), {
      params: Promise.resolve({ sessionId: "missing" }),
    });
    expect(notFoundRes.status).toBe(404);

    mockEnqueueSpeakerServer.mockRejectedValueOnce(new LiveSessionClosedError());
    const closedRes = await POST(makeRequest({ talkTitle: "Demo", durationMinutes: 3 }), {
      params: Promise.resolve({ sessionId: "closed" }),
    });
    expect(closedRes.status).toBe(409);

    mockEnqueueSpeakerServer.mockRejectedValueOnce(new LiveSessionDuplicateSpeakerError());
    const duplicateRes = await POST(makeRequest({ talkTitle: "Demo", durationMinutes: 3 }), {
      params: Promise.resolve({ sessionId: "duplicate" }),
    });
    expect(duplicateRes.status).toBe(409);
  });

  it("returns 400 when sessionId is whitespace-only", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const res = await POST(makeRequest({ talkTitle: "Demo", durationMinutes: 3 }), {
      params: Promise.resolve({ sessionId: "   " }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Session ID");
  });

  it("returns 400 when request body is not valid JSON", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const req = new NextRequest("http://localhost/api/live/session-1/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req, { params: Promise.resolve({ sessionId: "session-1" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid JSON");
  });

  it("returns 400 when talkTitle is a non-string type (normalizeTalkTitle)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const res = await POST(
      makeRequest({ talkTitle: 12345, durationMinutes: 3 }),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Talk title");
  });

  it("returns 400 when talkTitle exceeds 140 char max", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const longTitle = "x".repeat(141);
    const res = await POST(
      makeRequest({ talkTitle: longTitle, durationMinutes: 3 }),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 with duration error when durationMinutes is a non-number type", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const res = await POST(
      makeRequest({ talkTitle: "Demo", durationMinutes: "not-a-number" }),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Duration");
  });

  it("returns 400 with duration error when durationMinutes is not in LIVE_TALK_DURATIONS", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const res = await POST(
      makeRequest({ talkTitle: "Demo", durationMinutes: 7 }),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Duration");
  });

  it("falls back to email then 'Speaker' when user.name is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "fallback@example.com",
    });
    mockEnqueueSpeakerServer.mockResolvedValue({
      id: "entry-2",
      sessionId: "session-1",
      userId: "u1",
      speakerName: "fallback@example.com",
      speakerPhotoUrl: null,
      talkTitle: "Demo",
      durationMinutes: 3,
      status: "queued",
      createdAtMs: 1,
      updatedAtMs: 1,
    });
    await POST(makeRequest({ talkTitle: "Demo", durationMinutes: 3 }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(mockEnqueueSpeakerServer).toHaveBeenCalledWith(
      expect.objectContaining({ speakerName: "fallback@example.com", speakerPhotoUrl: null }),
    );
  });

  it("uses 'Speaker' default when both name and email are missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as never);
    mockEnqueueSpeakerServer.mockResolvedValue({
      id: "entry-3",
      sessionId: "session-1",
      userId: "u1",
      speakerName: "Speaker",
      speakerPhotoUrl: null,
      talkTitle: "Demo",
      durationMinutes: 3,
      status: "queued",
      createdAtMs: 1,
      updatedAtMs: 1,
    });
    await POST(makeRequest({ talkTitle: "Demo", durationMinutes: 3 }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(mockEnqueueSpeakerServer).toHaveBeenCalledWith(
      expect.objectContaining({ speakerName: "Speaker" }),
    );
  });

  it("returns 500 on unknown error from enqueueSpeakerServer", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    mockEnqueueSpeakerServer.mockRejectedValueOnce(new Error("unexpected"));
    const res = await POST(makeRequest({ talkTitle: "Demo", durationMinutes: 3 }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    consoleErrorSpy.mockRestore();
  });
});
