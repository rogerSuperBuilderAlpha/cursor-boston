/**
 * @jest-environment node
 */
jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_cfg: unknown, handler: (...args: unknown[]) => unknown) => handler,
  rateLimitConfigs: { oauthCallback: {} },
}));

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), logError: jest.fn() },
}));

jest.mock("@/lib/ludwitt-config", () => ({
  LUDWITT_STATE_COOKIE: "ludwitt_state",
  LUDWITT_PKCE_COOKIE: "ludwitt_pkce",
  LUDWITT_RETURN_TO_COOKIE: "ludwitt_return_to",
  LUDWITT_LINK_UID_COOKIE: "ludwitt_link_uid",
  LUDWITT_FINALIZE_COOKIE: "ludwitt_finalize",
  LUDWITT_TOKEN_URL: "https://ludwitt.example/token",
  LUDWITT_USERINFO_URL: "https://ludwitt.example/userinfo",
  fetchLudwittWithTimeout: jest.fn(),
  getLudwittClientId: jest.fn(() => null),
  getLudwittClientSecret: jest.fn(() => null),
  getLudwittRedirectUri: jest.fn(() => "http://localhost:3000/auth/callback"),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/auth/callback/route";

function requestWithCookies(
  search: string,
  cookies: Record<string, string>,
): NextRequest {
  const req = new NextRequest(`http://localhost:3000/auth/callback${search}`);
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

describe("GET /auth/callback", () => {
  it("redirects to login when OAuth params are missing", async () => {
    const res = await GET!(requestWithCookies("", {}));
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/login");
    expect(loc).toContain("missing_params");
  });

  it("redirects on provider error query param", async () => {
    const res = await GET!(
      requestWithCookies("?error=access_denied", {
        ludwitt_state: "s",
        ludwitt_pkce: "v",
      }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("access_denied");
  });

  it("redirects when state does not match cookie", async () => {
    const res = await GET!(
      requestWithCookies("?code=abc&state=wrong", {
        ludwitt_state: "expected",
        ludwitt_pkce: "verifier",
      }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("invalid_state");
  });

  it("redirects when Ludwitt client is not configured", async () => {
    const res = await GET!(
      requestWithCookies("?code=abc&state=ok", {
        ludwitt_state: "ok",
        ludwitt_pkce: "verifier",
      }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("not_configured");
  });
});
