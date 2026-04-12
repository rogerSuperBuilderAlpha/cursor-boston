/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/pair/respond/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  respondToPairRequestServer,
  PairRequestNotFoundError,
  PairRequestUnauthorizedError,
  PairRequestAlreadyRespondedError,
} from "@/lib/pair-programming/data-server";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/pair-programming/data-server", () => {
  class PairRequestNotFoundError extends Error {
    constructor() { super("Request not found"); this.name = "PairRequestNotFoundError"; }
  }
  class PairRequestUnauthorizedError extends Error {
    constructor() { super("Unauthorized"); this.name = "PairRequestUnauthorizedError"; }
  }
  class PairRequestAlreadyRespondedError extends Error {
    constructor() { super("Request has already been responded to"); this.name = "PairRequestAlreadyRespondedError"; }
  }
  return {
    respondToPairRequestServer: jest.fn(),
    PairRequestNotFoundError,
    PairRequestUnauthorizedError,
    PairRequestAlreadyRespondedError,
  };
});

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockRespond = respondToPairRequestServer as jest.MockedFunction<typeof respondToPairRequestServer>;

const testUser: VerifiedUser = { uid: "u1", name: "Test" };

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/pair/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/pair/respond", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makePostRequest({ requestId: "r1", action: "accept" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when requestId is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ action: "accept" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("requestId");
  });

  it("returns 400 when action is invalid", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ requestId: "r1", action: "maybe" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("accept");
  });

  it("returns success when accepting a request", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockRespond.mockResolvedValue({ status: "accepted", sessionId: "s1" });

    const res = await POST(makePostRequest({ requestId: "r1", action: "accept" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sessionId).toBe("s1");
    expect(body.message).toContain("accepted");
    expect(mockRespond).toHaveBeenCalledWith("r1", "u1", "accept");
  });

  it("returns success when declining a request", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockRespond.mockResolvedValue({ status: "declined" });

    const res = await POST(makePostRequest({ requestId: "r1", action: "decline" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("declined");
  });

  it("returns 404 when request not found", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    // Need to get the mocked error class from the mock module
    const { PairRequestNotFoundError: MockNotFound } = jest.requireMock("@/lib/pair-programming/data-server");
    mockRespond.mockRejectedValue(new MockNotFound());

    const res = await POST(makePostRequest({ requestId: "bad", action: "accept" }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the recipient", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { PairRequestUnauthorizedError: MockUnauth } = jest.requireMock("@/lib/pair-programming/data-server");
    mockRespond.mockRejectedValue(new MockUnauth());

    const res = await POST(makePostRequest({ requestId: "r1", action: "accept" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("only respond");
  });

  it("returns 400 when request already responded to", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { PairRequestAlreadyRespondedError: MockAlready } = jest.requireMock("@/lib/pair-programming/data-server");
    mockRespond.mockRejectedValue(new MockAlready());

    const res = await POST(makePostRequest({ requestId: "r1", action: "accept" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("already been responded");
  });

  it("returns 500 on unexpected error", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockRespond.mockRejectedValue(new Error("db down"));

    const res = await POST(makePostRequest({ requestId: "r1", action: "accept" }));
    expect(res.status).toBe(500);
  });
});
