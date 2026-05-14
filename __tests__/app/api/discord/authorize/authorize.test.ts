/**
 * @jest-environment node
 */
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";

function makeRequest(
  params: Record<string, string> = {},
  origin = "http://localhost:3000"
): NextRequest {
  const url = new URL(`${origin}/api/discord/authorize`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString(), { method: "GET" });
}

async function getFreshGET(envOverrides: Record<string, string> = {}) {
  jest.resetModules();
  Object.entries(envOverrides).forEach(([k, v]) => {
    process.env[k] = v;
  });
  const mod = await import("@/app/api/discord/authorize/route");
  return mod.GET;
}

describe("GET /api/discord/authorize", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  // 1. Missing client ID → redirect to error page
  it("redirects to /profile?discord=error when DISCORD_CLIENT_ID is not set", async () => {
    const GET = await getFreshGET({ NEXT_PUBLIC_DISCORD_CLIENT_ID: "" });
    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/profile");
    expect(location).toContain("discord=error");
    expect(location).toContain("message=not_configured");
  });

  // 2. Happy path → redirect to Discord OAuth URL
  it("redirects to Discord OAuth URL when client ID is configured", async () => {
    const GET = await getFreshGET({ NEXT_PUBLIC_DISCORD_CLIENT_ID: "test-client-id" });
    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(/^https:\/\/discord\.com\/api\/oauth2\/authorize/);
    expect(location).toContain("client_id=test-client-id");
    expect(location).toContain("response_type=code");
    expect(location).toContain("scope=identify+guilds");
  });

  // 3. State parameter is included in the redirect URL
  it("includes a state parameter in the Discord redirect URL", async () => {
    const GET = await getFreshGET({ NEXT_PUBLIC_DISCORD_CLIENT_ID: "test-client-id" });
    const res = await GET(makeRequest());

    const location = res.headers.get("location") ?? "";
    const redirectUrl = new URL(location);
    const state = redirectUrl.searchParams.get("state");
    expect(state).toBeTruthy();
    expect(state!.length).toBeGreaterThan(0);
  });

  // 4. State cookie is set on the response
  it("sets discord_oauth_state cookie on the response", async () => {
    const GET = await getFreshGET({ NEXT_PUBLIC_DISCORD_CLIENT_ID: "test-client-id" });
    const res = await GET(makeRequest());

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("discord_oauth_state=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Max-Age=600");
  });

  // 5. redirect_uri falls back to <origin>/api/discord/callback
  it("derives redirect_uri from request origin when env var is absent", async () => {
    const GET = await getFreshGET({
      NEXT_PUBLIC_DISCORD_CLIENT_ID: "test-client-id",
      NEXT_PUBLIC_DISCORD_REDIRECT_URI: "",
    });
    const res = await GET(makeRequest({}, "https://cursorboston.com"));

    const location = res.headers.get("location") ?? "";
    expect(location).toContain(
      encodeURIComponent("https://cursorboston.com/api/discord/callback")
    );
  });

  // 6. redirect_uri uses env var when set
  it("uses NEXT_PUBLIC_DISCORD_REDIRECT_URI env var when configured", async () => {
    const GET = await getFreshGET({
      NEXT_PUBLIC_DISCORD_CLIENT_ID: "test-client-id",
      NEXT_PUBLIC_DISCORD_REDIRECT_URI: "https://myapp.com/api/discord/callback",
    });
    const res = await GET(makeRequest());

    const location = res.headers.get("location") ?? "";
    expect(location).toContain(
      encodeURIComponent("https://myapp.com/api/discord/callback")
    );
  });

  // 7. Valid returnTo → sets discord_oauth_return_to cookie
  it("sets return_to cookie when a valid returnTo param is provided", async () => {
    const GET = await getFreshGET({ NEXT_PUBLIC_DISCORD_CLIENT_ID: "test-client-id" });
    const res = await GET(makeRequest({ returnTo: "/profile" }));

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("discord_oauth_return_to=%2Fprofile");
  });

  // 8. Invalid returnTo (absolute URL) → no return_to cookie
  it("does not set return_to cookie for an absolute URL returnTo", async () => {
    const GET = await getFreshGET({ NEXT_PUBLIC_DISCORD_CLIENT_ID: "test-client-id" });
    const res = await GET(makeRequest({ returnTo: "https://evil.com/steal" }));

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).not.toContain("discord_oauth_return_to");
  });

  // 9. returnTo starting with // → no return_to cookie (open-redirect guard)
  it("does not set return_to cookie for a protocol-relative returnTo", async () => {
    const GET = await getFreshGET({ NEXT_PUBLIC_DISCORD_CLIENT_ID: "test-client-id" });
    const res = await GET(makeRequest({ returnTo: "//evil.com" }));

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).not.toContain("discord_oauth_return_to");
  });
});
