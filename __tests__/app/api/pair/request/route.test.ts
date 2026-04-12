/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/pair/request/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  createPairRequestServer,
  getPairRequestsForUserServer,
} from "@/lib/pair-programming/data-server";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/pair-programming/data-server", () => ({
  createPairRequestServer: jest.fn(),
  getPairRequestsForUserServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockCreateRequest = createPairRequestServer as jest.MockedFunction<typeof createPairRequestServer>;
const mockGetRequests = getPairRequestsForUserServer as jest.MockedFunction<typeof getPairRequestsForUserServer>;

const testUser: VerifiedUser = { uid: "u1", name: "Test" };

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/pair/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(type?: string) {
  const url = type
    ? `http://localhost/api/pair/request?type=${type}`
    : "http://localhost/api/pair/request";
  return new NextRequest(url);
}

const futureTime = new Date(Date.now() + 86400000).toISOString();

const validBody = {
  toUserId: "u2",
  sessionType: "build-together",
  message: "Let's pair!",
  proposedTime: futureTime,
};

describe("GET /api/pair/request", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns received requests by default", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const requests = [{ id: "r1", fromUserId: "u2" }];
    mockGetRequests.mockResolvedValue(requests as any);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.requests).toEqual(requests);
    expect(mockGetRequests).toHaveBeenCalledWith("u1", "received");
  });

  it("returns sent requests when type=sent", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGetRequests.mockResolvedValue([]);

    const res = await GET(makeGetRequest("sent"));
    expect(res.status).toBe(200);
    expect(mockGetRequests).toHaveBeenCalledWith("u1", "sent");
  });

  it("returns 500 on internal error", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGetRequests.mockRejectedValue(new Error("db down"));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
  });
});

describe("POST /api/pair/request", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when toUserId is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ ...validBody, toUserId: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("toUserId");
  });

  it("returns 400 for invalid session type", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ ...validBody, sessionType: "invalid" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("session type");
  });

  it("returns 400 when message is empty", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ ...validBody, message: "   " }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Message");
  });

  it("returns 400 when message is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { message, ...noMessage } = validBody;
    const res = await POST(makePostRequest(noMessage));
    expect(res.status).toBe(400);
  });

  it("returns 400 when message exceeds 1000 chars", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ ...validBody, message: "x".repeat(1001) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("1000");
  });

  it("returns 400 when sending request to yourself", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ ...validBody, toUserId: "u1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("yourself");
  });

  it("returns 400 for invalid proposed time format", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ ...validBody, proposedTime: "not-a-date" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid proposed time");
  });

  it("returns 400 when proposed time is in the past", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const pastTime = new Date(Date.now() - 86400000).toISOString();
    const res = await POST(makePostRequest({ ...validBody, proposedTime: pastTime }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("future");
  });

  it("succeeds with valid body", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockCreateRequest.mockResolvedValue("req-123");

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.requestId).toBe("req-123");
    expect(mockCreateRequest).toHaveBeenCalledWith(expect.objectContaining({
      fromUserId: "u1",
      toUserId: "u2",
      sessionType: "build-together",
      message: "Let's pair!",
    }));
  });

  it("succeeds without proposedTime", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockCreateRequest.mockResolvedValue("req-456");
    const { proposedTime, ...bodyWithout } = validBody;

    const res = await POST(makePostRequest(bodyWithout));
    expect(res.status).toBe(200);
    expect(mockCreateRequest).toHaveBeenCalledWith(expect.objectContaining({
      proposedTime: undefined,
    }));
  });

  it("returns 500 on internal error", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockCreateRequest.mockRejectedValue(new Error("db down"));

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(500);
  });
});
