/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/live/[sessionId]/control/route";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  controlLiveSessionServer,
  LiveSessionInvalidActionError,
  LiveSessionNotFoundError,
  LiveSessionUnauthorizedError,
} from "@/lib/live-sessions/data-server";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/live-sessions/data-server", () => ({
  controlLiveSessionServer: jest.fn(),
  LiveSessionNotFoundError: class LiveSessionNotFoundError extends Error {},
  LiveSessionUnauthorizedError: class LiveSessionUnauthorizedError extends Error {},
  LiveSessionInvalidActionError: class LiveSessionInvalidActionError extends Error {},
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockControlLiveSessionServer =
  controlLiveSessionServer as jest.MockedFunction<typeof controlLiveSessionServer>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/live/session-1/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/live/[sessionId]/control", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires authentication", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ action: "start-next" }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("validates actions", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin-1" });
    const res = await POST(makeRequest({ action: "unknown" }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("dispatches valid actions", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin-1" });
    mockControlLiveSessionServer.mockResolvedValue({
      session: {
        status: "live",
        timer: { status: "running" },
        currentSpeaker: { speakerName: "A", talkTitle: "B", entryId: "entry-1" },
      },
      queue: { order: [], items: {}, updatedAtMs: 1 },
      historyRecord: null,
    } as never);

    const res = await POST(makeRequest({ action: "start-next" }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });

    expect(res.status).toBe(200);
    expect(mockControlLiveSessionServer).toHaveBeenCalledWith({
      sessionId: "session-1",
      emceeUid: "admin-1",
      action: "start-next",
      entryId: undefined,
      targetIndex: undefined,
    });
  });

  it("maps domain errors", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin-1" });

    mockControlLiveSessionServer.mockRejectedValueOnce(new LiveSessionNotFoundError());
    const notFound = await POST(makeRequest({ action: "start-next" }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(notFound.status).toBe(404);

    mockControlLiveSessionServer.mockRejectedValueOnce(new LiveSessionUnauthorizedError());
    const forbidden = await POST(makeRequest({ action: "start-next" }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(forbidden.status).toBe(403);

    mockControlLiveSessionServer.mockRejectedValueOnce(
      new LiveSessionInvalidActionError("bad")
    );
    const badRequest = await POST(makeRequest({ action: "start-next" }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(badRequest.status).toBe(400);
  });
});
