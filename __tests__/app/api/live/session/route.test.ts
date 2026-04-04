/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/live/session/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { createLiveSessionServer } from "@/lib/live-sessions/data-server";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/live-sessions/data-server", () => ({
  createLiveSessionServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockCreateLiveSessionServer =
  createLiveSessionServer as jest.MockedFunction<typeof createLiveSessionServer>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/live/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/live/session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires authentication", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);

    const res = await POST(makeRequest({ title: "Demo Night" }));

    expect(res.status).toBe(401);
  });

  it("requires admin privileges", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "user-1",
      email: "member@example.com",
      isAdmin: false,
    });

    const res = await POST(makeRequest({ title: "Demo Night" }));

    expect(res.status).toBe(403);
  });

  it("creates a live session for admins", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin-1",
      email: "admin@example.com",
      name: "Host User",
      isAdmin: true,
    });
    mockCreateLiveSessionServer.mockResolvedValue({
      sessionId: "session-123",
      session: {
        id: "session-123",
        status: "pending",
        title: "Demo Night",
        createdAtMs: 100,
        updatedAtMs: 100,
        emceeUid: "admin-1",
        emceeName: "Host User",
        audiencePath: "/live/session-123",
        emceePath: "/live/session-123/emcee",
        currentSpeaker: {
          entryId: null,
          speakerName: null,
          talkTitle: null,
        },
        timer: {
          status: "idle",
          durationSeconds: 0,
          remainingSeconds: 0,
          startedAtMs: null,
          pausedAtMs: null,
          warningThresholds: [60, 30],
        },
      },
    });

    const res = await POST(makeRequest({ title: " Demo Night " }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockCreateLiveSessionServer).toHaveBeenCalledWith({
      title: "Demo Night",
      emceeUid: "admin-1",
      emceeName: "Host User",
    });
    expect(body).toEqual({
      sessionId: "session-123",
      title: "Demo Night",
      audiencePath: "/live/session-123",
      emceePath: "/live/session-123/emcee",
      status: "pending",
    });
  });

  it("defaults the title when omitted", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin-1",
      email: "admin@example.com",
      isAdmin: true,
    });
    mockCreateLiveSessionServer.mockResolvedValue({
      sessionId: "session-456",
      session: {
        id: "session-456",
        status: "pending",
        title: "Lightning Talks",
        createdAtMs: 100,
        updatedAtMs: 100,
        emceeUid: "admin-1",
        emceeName: "admin@example.com",
        audiencePath: "/live/session-456",
        emceePath: "/live/session-456/emcee",
        currentSpeaker: {
          entryId: null,
          speakerName: null,
          talkTitle: null,
        },
        timer: {
          status: "idle",
          durationSeconds: 0,
          remainingSeconds: 0,
          startedAtMs: null,
          pausedAtMs: null,
          warningThresholds: [60, 30],
        },
      },
    });

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(200);
    expect(mockCreateLiveSessionServer).toHaveBeenCalledWith({
      title: "Lightning Talks",
      emceeUid: "admin-1",
      emceeName: "admin@example.com",
    });
  });

  it("rejects invalid titles", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin-1",
      email: "admin@example.com",
      isAdmin: true,
    });

    const res = await POST(makeRequest({ title: "x".repeat(121) }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Title must be a string");
    expect(mockCreateLiveSessionServer).not.toHaveBeenCalled();
  });
});
