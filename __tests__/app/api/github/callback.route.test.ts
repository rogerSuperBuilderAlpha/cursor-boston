/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #16 — github callback (OAuth completion).
 *
 * The route reads GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET at module load,
 * so each test that depends on those env vars does a fresh module import.
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_config: unknown, handler: (req: unknown) => unknown) => handler,
  rateLimitConfigs: { oauthCallback: {} },
}));
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logError: jest.fn(),
  },
}));

function makeReq(opts: {
  code?: string;
  state?: string;
  cookies?: Record<string, string>;
}) {
  const url = new URL("https://example.com/api/github/callback");
  if (opts.code !== undefined) url.searchParams.set("code", opts.code);
  if (opts.state !== undefined) url.searchParams.set("state", opts.state);
  const cookieHeader = Object.entries(opts.cookies ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(url, {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

async function importGet(env: Record<string, string | undefined> = {}) {
  process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID = env.NEXT_PUBLIC_GITHUB_CLIENT_ID ?? "client-id";
  process.env.GITHUB_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET ?? "client-secret";
  if (env.NEXT_PUBLIC_GITHUB_CLIENT_ID === "") delete process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  if (env.GITHUB_CLIENT_SECRET === "") delete process.env.GITHUB_CLIENT_SECRET;
  jest.resetModules();
  const mod = await import("@/app/api/github/callback/route");
  return mod.GET;
}

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("GET /api/github/callback", () => {
  it("redirects with missing_params when code is absent", async () => {
    const GET = await importGet();
    const res = await GET(makeReq({ state: "s1" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("missing_params");
  });

  it("redirects with missing_params when state is absent", async () => {
    const GET = await importGet();
    const res = await GET(makeReq({ code: "c1" }));
    expect(res.headers.get("location")).toContain("missing_params");
  });

  it("redirects with invalid_state when state cookie is missing", async () => {
    const GET = await importGet();
    const res = await GET(makeReq({ code: "c1", state: "s1" }));
    expect(res.headers.get("location")).toContain("invalid_state");
  });

  it("redirects with invalid_state when cookie state mismatches", async () => {
    const GET = await importGet();
    const res = await GET(
      makeReq({ code: "c1", state: "s1", cookies: { github_oauth_state: "different" } }),
    );
    expect(res.headers.get("location")).toContain("invalid_state");
  });

  it("redirects with not_configured when GITHUB_CLIENT_ID missing", async () => {
    const GET = await importGet({ NEXT_PUBLIC_GITHUB_CLIENT_ID: "" });
    const res = await GET(
      makeReq({ code: "c1", state: "s1", cookies: { github_oauth_state: "s1" } }),
    );
    expect(res.headers.get("location")).toContain("not_configured");
  });

  it("redirects with token_failed when token exchange returns !ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve("bad request"),
    });
    const GET = await importGet();
    const res = await GET(
      makeReq({ code: "c1", state: "s1", cookies: { github_oauth_state: "s1" } }),
    );
    expect(res.headers.get("location")).toContain("token_failed");
  });

  it("redirects with token_failed when token response carries an error field", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ error: "bad_verification_code" }),
    });
    const GET = await importGet();
    const res = await GET(
      makeReq({ code: "c1", state: "s1", cookies: { github_oauth_state: "s1" } }),
    );
    expect(res.headers.get("location")).toContain("token_failed");
  });

  it("redirects with user_fetch_failed when /user returns !ok", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "abc" }),
      })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    const GET = await importGet();
    const res = await GET(
      makeReq({ code: "c1", state: "s1", cookies: { github_oauth_state: "s1" } }),
    );
    expect(res.headers.get("location")).toContain("user_fetch_failed");
  });

  it("redirects with success and encoded user data on happy path", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "abc" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 42,
            login: "octocat",
            name: "Mona",
            avatar_url: "https://avatar",
            html_url: "https://github.com/octocat",
          }),
      });
    const GET = await importGet();
    const res = await GET(
      makeReq({ code: "c1", state: "s1", cookies: { github_oauth_state: "s1" } }),
    );
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("github=success");
    expect(decodeURIComponent(loc)).toContain("octocat");
  });

  it("redirects with 'unknown' on fetch throw", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));
    const GET = await importGet();
    const res = await GET(
      makeReq({ code: "c1", state: "s1", cookies: { github_oauth_state: "s1" } }),
    );
    expect(res.headers.get("location")).toContain("github=error&message=unknown");
  });
});
