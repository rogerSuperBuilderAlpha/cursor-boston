/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #48 — pair/request GET + POST.
 */
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/pair/request/route";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  createPairRequestServer,
  getPairRequestsForUserServer,
} from "@/lib/pair-programming/data-server";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/pair-programming/data-server", () => ({
  createPairRequestServer: jest.fn(),
  getPairRequestsForUserServer: jest.fn(),
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockCreate = createPairRequestServer as jest.MockedFunction<
  typeof createPairRequestServer
>;
const mockGetRequests = getPairRequestsForUserServer as jest.MockedFunction<
  typeof getPairRequestsForUserServer
>;

function makeReq(opts: {
  method?: "GET" | "POST";
  searchParams?: Record<string, string>;
  body?: unknown;
} = {}) {
  const url = new URL("https://example.com/api/pair/request");
  for (const [k, v] of Object.entries(opts.searchParams ?? {})) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/pair/request", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Authentication required");
  });

  it("returns received requests by default", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    mockGetRequests.mockResolvedValue([{ id: "r1" }] as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toEqual([{ id: "r1" }]);
    expect(mockGetRequests).toHaveBeenCalledWith("u1", "received");
  });

  it("returns sent requests when type=sent is in the query string", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    mockGetRequests.mockResolvedValue([] as never);
    await GET(makeReq({ searchParams: { type: "sent" } }));
    expect(mockGetRequests).toHaveBeenCalledWith("u1", "sent");
  });

  it("defaults to received when type is unrecognised (e.g. 'all')", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    mockGetRequests.mockResolvedValue([] as never);
    await GET(makeReq({ searchParams: { type: "all" } }));
    expect(mockGetRequests).toHaveBeenCalledWith("u1", "received");
  });

  it("returns 500 when getPairRequestsForUserServer throws", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    mockGetRequests.mockRejectedValue(new Error("db down"));
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch requests");
    consoleErrorSpy.mockRestore();
  });
});

describe("POST /api/pair/request", () => {
  const VALID_BODY = {
    toUserId: "u2",
    sessionType: "build-together",
    message: "Hey, want to pair?",
  };

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid JSON", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const req = new NextRequest("https://example.com/api/pair/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when zod schema rejects the body", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const res = await POST(
      makeReq({ method: "POST", body: { toUserId: "u2" } /* missing fields */ }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is whitespace-only", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const res = await POST(
      makeReq({ method: "POST", body: { ...VALID_BODY, message: "   " } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Message is required");
  });

  it("returns 400 when sending to self", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const res = await POST(
      makeReq({ method: "POST", body: { ...VALID_BODY, toUserId: "u1" } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("yourself");
  });

  it("returns 400 when proposedTime is unparseable", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const res = await POST(
      makeReq({
        method: "POST",
        body: { ...VALID_BODY, proposedTime: "not-a-date" },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid proposed time");
  });

  it("returns 400 when proposedTime is in the past", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const res = await POST(
      makeReq({
        method: "POST",
        body: { ...VALID_BODY, proposedTime: "2020-01-01T00:00:00Z" },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("future");
  });

  it("creates the pair request on happy path (no proposedTime)", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    mockCreate.mockResolvedValue("new-req-id" as never);
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestId).toBe("new-req-id");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        fromUserId: "u1",
        toUserId: "u2",
        sessionType: "build-together",
        message: "Hey, want to pair?",
        proposedTime: undefined,
      }),
    );
  });

  it("creates the pair request with a future proposedTime", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    mockCreate.mockResolvedValue("new-req-id" as never);
    const futureIso = new Date(Date.now() + 86400000).toISOString();
    await POST(
      makeReq({ method: "POST", body: { ...VALID_BODY, proposedTime: futureIso } }),
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ proposedTime: expect.any(Date) }),
    );
  });

  it("returns 500 when createPairRequestServer throws", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    mockCreate.mockRejectedValue(new Error("db error"));
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create request");
    consoleErrorSpy.mockRestore();
  });
});
