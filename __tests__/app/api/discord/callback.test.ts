/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

// withMiddleware wraps the inner handler with rate limiting + logging.
// For unit tests, treat it as a pass-through so we test the handler directly.
jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_config: unknown, handler: any) => handler,
  rateLimitConfigs: { oauthCallback: {} },
}));

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

/** Re-import the callback route with the supplied env. */
function loadCallback(env: Record<string, string | undefined>) {
  let mod: typeof import("@/app/api/discord/callback/route");
  jest.isolateModules(() => {
    const previous: Record<string, string | undefined> = {};
    Object.keys(env).forEach((k) => {
      previous[k] = process.env[k];
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    });
    mod = require("@/app/api/discord/callback/route");
    Object.keys(previous).forEach((k) => {
      if (previous[k] === undefined) delete process.env[k];
      else process.env[k] = previous[k];
    });
  });
  return mod!;
}

const HAPPY_ENV = {
  NEXT_PUBLIC_DISCORD_CLIENT_ID: "test-client-id",
  DISCORD_CLIENT_SECRET: "test-client-secret",
  CURSOR_BOSTON_DISCORD_SERVER_ID: "12345",
  NEXT_PUBLIC_DISCORD_REDIRECT_URI: "https://app.example.com/api/discord/callback",
};

function callbackRequest(opts: {
  code?: string | null;
  state?: string | null;
  stateCookie?: string;
  returnToCookie?: string;
}) {
  const url = new URL("http://localhost/api/discord/callback");
  if (opts.code !== null && opts.code !== undefined) url.searchParams.set("code", opts.code);
  if (opts.state !== null && opts.state !== undefined) url.searchParams.set("state", opts.state);
  const cookiePairs: string[] = [];
  if (opts.stateCookie !== undefined) cookiePairs.push(`discord_oauth_state=${opts.stateCookie}`);
  if (opts.returnToCookie !== undefined)
    cookiePairs.push(`discord_oauth_return_to=${opts.returnToCookie}`);
  return new NextRequest(url, {
    method: "GET",
    headers: cookiePairs.length ? { cookie: cookiePairs.join("; ") } : {},
  });
}

function locationOf(res: Response) {
  return res.headers.get("location") ?? "";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body: string, status: number) {
  return new Response(body, { status });
}

describe("GET /api/discord/callback", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("redirects to error missing_params when code is absent", async () => {
    const { GET } = loadCallback(HAPPY_ENV);
    const res = await GET(callbackRequest({ state: "s", stateCookie: "s" }));
    expect(locationOf(res)).toContain("discord=error");
    expect(locationOf(res)).toContain("message=missing_params");
  });

  it("redirects to error missing_params when state is absent", async () => {
    const { GET } = loadCallback(HAPPY_ENV);
    const res = await GET(callbackRequest({ code: "c", stateCookie: "s" }));
    expect(locationOf(res)).toContain("message=missing_params");
  });

  it("redirects to error invalid_state when no state cookie is set", async () => {
    const { GET } = loadCallback(HAPPY_ENV);
    const res = await GET(callbackRequest({ code: "c", state: "s" }));
    expect(locationOf(res)).toContain("message=invalid_state");
  });

  it("redirects to error invalid_state when cookie state mismatches query state", async () => {
    const { GET } = loadCallback(HAPPY_ENV);
    const res = await GET(callbackRequest({ code: "c", state: "x", stateCookie: "y" }));
    expect(locationOf(res)).toContain("message=invalid_state");
  });

  it("redirects to error not_configured when DISCORD_CLIENT_SECRET is unset", async () => {
    const { GET } = loadCallback({
      ...HAPPY_ENV,
      DISCORD_CLIENT_SECRET: undefined,
    });
    const res = await GET(callbackRequest({ code: "c", state: "s", stateCookie: "s" }));
    expect(locationOf(res)).toContain("message=not_configured");
  });

  it("redirects to error token_failed when Discord rejects the token exchange", async () => {
    const { GET } = loadCallback(HAPPY_ENV);
    global.fetch = jest.fn().mockResolvedValueOnce(textResponse("bad code", 400));
    const res = await GET(callbackRequest({ code: "c", state: "s", stateCookie: "s" }));
    expect(locationOf(res)).toContain("message=token_failed");
  });

  it("redirects to error user_fetch_failed when /users/@me returns non-OK", async () => {
    const { GET } = loadCallback(HAPPY_ENV);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok" })) // token
      .mockResolvedValueOnce(textResponse("forbidden", 401)); // user
    const res = await GET(callbackRequest({ code: "c", state: "s", stateCookie: "s" }));
    expect(locationOf(res)).toContain("message=user_fetch_failed");
  });

  it("redirects to error guilds_fetch_failed when /users/@me/guilds returns non-OK", async () => {
    const { GET } = loadCallback(HAPPY_ENV);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok" }))
      .mockResolvedValueOnce(jsonResponse({ id: "u1", username: "alice" }))
      .mockResolvedValueOnce(textResponse("rate-limit", 429));
    const res = await GET(callbackRequest({ code: "c", state: "s", stateCookie: "s" }));
    expect(locationOf(res)).toContain("message=guilds_fetch_failed");
  });

  it("redirects to error not_member when the user is not in the Cursor Boston Discord", async () => {
    const { GET } = loadCallback(HAPPY_ENV);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok" }))
      .mockResolvedValueOnce(jsonResponse({ id: "u1", username: "alice" }))
      .mockResolvedValueOnce(jsonResponse([{ id: "99999" }, { id: "other" }]));
    const res = await GET(callbackRequest({ code: "c", state: "s", stateCookie: "s" }));
    expect(locationOf(res)).toContain("message=not_member");
  });

  it("redirects to success with the discord user payload encoded when the user is a member", async () => {
    const { GET } = loadCallback(HAPPY_ENV);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok" }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "u1",
          username: "alice",
          global_name: "Alice",
          avatar: "abc123",
        })
      )
      .mockResolvedValueOnce(jsonResponse([{ id: "12345" }, { id: "other" }]));
    const res = await GET(callbackRequest({ code: "c", state: "s", stateCookie: "s" }));
    const location = locationOf(res);
    expect(location).toContain("discord=success");
    expect(location).toContain("data=");
    // Decode and assert the payload
    const dataParam = new URL(location, "http://localhost").searchParams.get("data");
    expect(dataParam).not.toBeNull();
    const payload = JSON.parse(decodeURIComponent(dataParam!));
    expect(payload).toEqual({
      id: "u1",
      username: "alice",
      globalName: "Alice",
      avatar: "abc123",
    });
  });

  it("honors the returnTo cookie when set to a valid relative path", async () => {
    const { GET } = loadCallback(HAPPY_ENV);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok" }))
      .mockResolvedValueOnce(jsonResponse({ id: "u1", username: "alice" }))
      .mockResolvedValueOnce(jsonResponse([{ id: "12345" }]));
    const res = await GET(
      callbackRequest({
        code: "c",
        state: "s",
        stateCookie: "s",
        returnToCookie: "/settings",
      })
    );
    const location = locationOf(res);
    expect(location).toContain("/settings?discord=success");
  });

  it("falls back to /profile when no returnTo cookie is set", async () => {
    const { GET } = loadCallback(HAPPY_ENV);
    const res = await GET(callbackRequest({ state: "s", stateCookie: "s" }));
    expect(locationOf(res)).toContain("/profile?");
  });

  it("redirects to error unknown when fetch throws unexpectedly", async () => {
    const { GET } = loadCallback(HAPPY_ENV);
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("network-down"));
    const res = await GET(callbackRequest({ code: "c", state: "s", stateCookie: "s" }));
    expect(locationOf(res)).toContain("message=unknown");
  });

  it("clears the state and returnTo cookies on every callback redirect", async () => {
    const { GET } = loadCallback(HAPPY_ENV);
    const res = await GET(callbackRequest({ state: "s", stateCookie: "s" }));
    const setCookies = res.headers.getSetCookie?.() ?? [];
    const stateClear = setCookies.find(
      (c) => c.startsWith("discord_oauth_state=") && c.includes("Max-Age=0")
    );
    const returnClear = setCookies.find(
      (c) => c.startsWith("discord_oauth_return_to=") && c.includes("Max-Age=0")
    );
    expect(stateClear).toBeDefined();
    expect(returnClear).toBeDefined();
  });
});
