/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #14 — github authorize route.
 */
import { GET } from "@/app/api/github/authorize/route";
import { NextRequest } from "next/server";

function makeReq(url: string) {
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/github/authorize", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("redirects to error page when GITHUB_CLIENT_ID is missing", async () => {
    delete process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    jest.resetModules();
    const { GET: getFresh } = await import("@/app/api/github/authorize/route");
    const res = await getFresh(makeReq("https://example.com/api/github/authorize"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/profile?github=error&message=not_configured");
  });

  it("redirects to GitHub OAuth + sets state cookie on happy path", async () => {
    process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID = "fake-client";
    delete process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI;
    jest.resetModules();
    const { GET: getFresh } = await import("@/app/api/github/authorize/route");
    const res = await getFresh(makeReq("https://example.com/api/github/authorize"));
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("https://github.com/login/oauth/authorize?");
    expect(loc).toContain("client_id=fake-client");
    expect(loc).toContain("scope=read%3Auser");
    expect(loc).toContain("redirect_uri=");
    expect(loc).toMatch(/state=[A-Za-z0-9_-]{40,}/);
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("github_oauth_state=");
  });

  it("respects NEXT_PUBLIC_GITHUB_REDIRECT_URI when set", async () => {
    process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID = "fake-client";
    process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI = "https://override.example.com/cb";
    jest.resetModules();
    const { GET: getFresh } = await import("@/app/api/github/authorize/route");
    const res = await getFresh(makeReq("https://example.com/api/github/authorize"));
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("redirect_uri=" + encodeURIComponent("https://override.example.com/cb"));
  });

  it("sets return_to cookie for safe relative returnTo", async () => {
    process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID = "fake-client";
    jest.resetModules();
    const { GET: getFresh } = await import("@/app/api/github/authorize/route");
    const res = await getFresh(
      makeReq("https://example.com/api/github/authorize?returnTo=/profile%3Ftab%3Dconnections"),
    );
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("github_oauth_return_to=");
  });

  it("rejects open-redirect returnTo (starts with //)", async () => {
    process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID = "fake-client";
    jest.resetModules();
    const { GET: getFresh } = await import("@/app/api/github/authorize/route");
    const res = await getFresh(
      makeReq("https://example.com/api/github/authorize?returnTo=//evil.com/x"),
    );
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).not.toContain("github_oauth_return_to=");
  });

  it("rejects returnTo not starting with /", async () => {
    process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID = "fake-client";
    jest.resetModules();
    const { GET: getFresh } = await import("@/app/api/github/authorize/route");
    const res = await getFresh(
      makeReq("https://example.com/api/github/authorize?returnTo=https://evil.com"),
    );
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).not.toContain("github_oauth_return_to=");
  });

  it("does not set return_to cookie when returnTo is absent", async () => {
    process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID = "fake-client";
    jest.resetModules();
    const { GET: getFresh } = await import("@/app/api/github/authorize/route");
    const res = await getFresh(
      makeReq("https://example.com/api/github/authorize"),
    );
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).not.toContain("github_oauth_return_to=");
  });
});
