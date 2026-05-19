/**
 * @jest-environment node
 *
 * Coverage sprint 80 — Ludwitt AI messages proxy route.
 */
import { POST } from "@/app/api/ludwitt/ai/messages/route";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  deleteLudwittTokens,
  withFreshLudwittAccessToken,
} from "@/lib/ludwitt-tokens";
import { fetchLudwittWithTimeout, LUDWITT_TOPUP_URL } from "@/lib/ludwitt-config";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_: unknown, handler: (req: unknown) => unknown) => handler,
  rateLimitConfigs: { standard: {} },
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/ludwitt-tokens", () => ({
  withFreshLudwittAccessToken: jest.fn(),
  deleteLudwittTokens: jest.fn(),
}));

jest.mock("@/lib/ludwitt-config", () => ({
  LUDWITT_AI_MESSAGES_URL: "https://ludwitt.example/ai/messages",
  LUDWITT_TOPUP_URL: "https://ludwitt.example/topup",
  fetchLudwittWithTimeout: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockWithFresh = withFreshLudwittAccessToken as jest.MockedFunction<
  typeof withFreshLudwittAccessToken
>;
const mockDeleteTokens = deleteLudwittTokens as jest.MockedFunction<typeof deleteLudwittTokens>;
const mockFetchLudwitt = fetchLudwittWithTimeout as jest.MockedFunction<
  typeof fetchLudwittWithTimeout
>;

const user = { uid: "uid-1", email: "u@example.com", name: "User" };

const validBody = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 256,
  messages: [{ role: "user" as const, content: "hello" }],
};

function upstreamResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return {
    status,
    json: async () => body,
    headers: new Headers(headers),
  };
}

describe("POST /api/ludwitt/ai/messages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockWithFresh.mockImplementation(async (_uid, fn) =>
      fn("access-token"),
    );
    mockDeleteTokens.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    const { status, body } = await readJson<{ error: string }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/ludwitt/ai/messages",
          body: validBody,
        }),
      ),
    );
    expect(status).toBe(401);
    expect(body.error).toBe("unauthenticated");
  });

  it("returns 400 for invalid JSON", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    const res = await POST(
      new Request("http://localhost:3000/api/ludwitt/ai/messages", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-token",
          "content-type": "application/json",
        },
        body: "{",
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when the contract body fails validation", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    const { status, body } = await readJson<{ error: string }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/ludwitt/ai/messages",
          body: { model: "", max_tokens: 0, messages: [] },
        }),
      ),
    );
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_body");
  });

  it("returns 412 when Ludwitt is not connected", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockWithFresh.mockRejectedValue(new Error("ludwitt_not_connected"));

    const { status, body } = await readJson<{ error: string; connectUrl: string }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/ludwitt/ai/messages",
          body: validBody,
        }),
      ),
    );
    expect(status).toBe(412);
    expect(body.error).toBe("ludwitt_not_connected");
    expect(body.connectUrl).toBe("/api/ludwitt/authorize");
  });

  it("returns 502 on unexpected upstream errors", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockWithFresh.mockRejectedValue(new Error("network down"));

    const { status, body } = await readJson<{ error: string }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/ludwitt/ai/messages",
          body: validBody,
        }),
      ),
    );
    expect(status).toBe(502);
    expect(body.error).toBe("upstream_failed");
  });

  it("clears tokens and returns 401 when upstream session is dead", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockFetchLudwitt.mockResolvedValue(
      upstreamResponse(401, { error: "expired" }) as never,
    );

    const { status, body } = await readJson<{ error: string }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/ludwitt/ai/messages",
          body: validBody,
        }),
      ),
    );

    expect(status).toBe(401);
    expect(body.error).toBe("ludwitt_session_expired");
    expect(mockDeleteTokens).toHaveBeenCalledWith(user.uid);
  });

  it("returns 402 with top-up URL when out of credits", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockFetchLudwitt.mockResolvedValue(
      upstreamResponse(402, { error: "credits" }) as never,
    );

    const { status, body } = await readJson<{ error: string; topUpUrl: string }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/ludwitt/ai/messages",
          body: validBody,
        }),
      ),
    );

    expect(status).toBe(402);
    expect(body.error).toBe("out_of_credits");
    expect(body.topUpUrl).toBe(LUDWITT_TOPUP_URL);
  });

  it("forwards client errors from upstream", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockFetchLudwitt.mockResolvedValue(
      upstreamResponse(429, { error: "rate_limited" }) as never,
    );

    const { status, body } = await readJson<{
      error: string;
      upstreamStatus: number;
    }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/ludwitt/ai/messages",
          body: validBody,
        }),
      ),
    );

    expect(status).toBe(429);
    expect(body.error).toBe("upstream_error");
    expect(body.upstreamStatus).toBe(429);
  });

  it("maps upstream 5xx to 502", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockFetchLudwitt.mockResolvedValue(
      upstreamResponse(503, { error: "busy" }) as never,
    );

    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/ludwitt/ai/messages",
          body: validBody,
        }),
      ),
    );
    expect(status).toBe(502);
  });

  it("returns upstream JSON on success and forwards credit header", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockFetchLudwitt.mockResolvedValue(
      upstreamResponse(
        200,
        { id: "msg-1", content: [{ type: "text", text: "hi" }] },
        { "x-ludwitt-credits": "42" },
      ) as never,
    );

    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/ludwitt/ai/messages",
        body: validBody,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("msg-1");
    expect(res.headers.get("x-ludwitt-credits")).toBe("42");
    expect(mockFetchLudwitt).toHaveBeenCalledWith(
      "https://ludwitt.example/ai/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("returns success without credit header when upstream omits it", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockFetchLudwitt.mockResolvedValue(
      upstreamResponse(200, { ok: true }) as never,
    );

    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/ludwitt/ai/messages",
        body: validBody,
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("x-ludwitt-credits")).toBeNull();
  });

  it("treats non-JSON upstream bodies as null", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockFetchLudwitt.mockResolvedValue({
      status: 200,
      json: async () => {
        throw new Error("invalid json");
      },
      headers: new Headers(),
    } as never);

    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/ludwitt/ai/messages",
        body: validBody,
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toBeNull();
  });
});
