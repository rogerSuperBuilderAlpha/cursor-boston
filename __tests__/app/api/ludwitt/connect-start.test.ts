/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment node
 *
 * OpenSSF Gold coverage — `app/api/ludwitt/connect-start/route.ts`
 * was at 22.5% statements (31 uncovered). Covers unauthenticated 401,
 * not_configured 500, default returnTo, sanitized returnTo (relative
 * path passes; protocol-relative + non-slash rejected), happy path
 * cookie set + authorizeUrl shape.
 */

import { NextRequest } from "next/server";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/ludwitt-config", () => ({
  LUDWITT_AUTHORIZE_URL: "https://ludwitt.example/oauth/authorize",
  LUDWITT_LINK_UID_COOKIE: "ldw_uid",
  LUDWITT_PKCE_COOKIE: "ldw_pkce",
  LUDWITT_RETURN_TO_COOKIE: "ldw_return",
  LUDWITT_SCOPES: "openid email",
  LUDWITT_STATE_COOKIE: "ldw_state",
  getLudwittClientId: jest.fn(() => "client-abc"),
  getLudwittRedirectUri: jest.fn(() => "https://app.test/api/ludwitt/connect-complete"),
}));

jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_cfg: unknown, handler: (req: NextRequest) => Promise<Response>) => handler,
  rateLimitConfigs: { standard: {} },
}));

import { POST } from "@/app/api/ludwitt/connect-start/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getLudwittClientId } from "@/lib/ludwitt-config";

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetClientId = getLudwittClientId as jest.MockedFunction<typeof getLudwittClientId>;

function makeRequest(body?: unknown) {
  return new NextRequest("https://app.test/api/ludwitt/connect-start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetClientId.mockReturnValue("client-abc");
});

describe("POST /api/ludwitt/connect-start", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthenticated");
  });

  it("returns 500 when LUDWITT_CLIENT_ID env is unset", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    mockGetClientId.mockReturnValueOnce("");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("not_configured");
  });

  it("returns 200 with an authorizeUrl + sets four cookies on success", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" });
    const res = await POST(makeRequest({ returnTo: "/profile/connections" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authorizeUrl).toContain("https://ludwitt.example/oauth/authorize?");
    expect(body.authorizeUrl).toContain("client_id=client-abc");
    expect(body.authorizeUrl).toContain("response_type=code");
    expect(body.authorizeUrl).toContain("code_challenge_method=S256");

    const cookieHeader = res.headers.getSetCookie?.() ?? [];
    expect(cookieHeader.length).toBeGreaterThanOrEqual(4);
  });

  it("defaults returnTo to /profile when body is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    const req = new NextRequest("https://app.test/api/ludwitt/connect-start", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie?.() ?? [];
    const returnCookie = cookies.find((c) => c.startsWith("ldw_return="));
    expect(returnCookie).toContain("ldw_return=%2Fprofile");
  });

  it("rejects protocol-relative returnTo and falls back to /profile", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    const res = await POST(makeRequest({ returnTo: "//evil.example.com/" }));
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie?.() ?? [];
    const returnCookie = cookies.find((c) => c.startsWith("ldw_return="));
    expect(returnCookie).toContain("%2Fprofile");
    expect(returnCookie).not.toContain("evil.example");
  });

  it("rejects non-string returnTo and falls back to /profile", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    const res = await POST(makeRequest({ returnTo: 12345 }));
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie?.() ?? [];
    expect(cookies.find((c) => c.startsWith("ldw_return="))).toContain("%2Fprofile");
  });

  it("rejects relative-no-leading-slash returnTo and falls back to /profile", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    const res = await POST(makeRequest({ returnTo: "not-leading-slash" }));
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie?.() ?? [];
    expect(cookies.find((c) => c.startsWith("ldw_return="))).toContain("%2Fprofile");
  });

  it("handles invalid JSON body without throwing (falls back to default returnTo)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    const req = new NextRequest("https://app.test/api/ludwitt/connect-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("PKCE challenge is S256-encoded and url-safe (no = + / chars)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    const res = await POST(makeRequest({}));
    const body = await res.json();
    const url = new URL(body.authorizeUrl);
    const challenge = url.searchParams.get("code_challenge")!;
    expect(challenge.length).toBeGreaterThan(20);
    expect(challenge).not.toMatch(/[+/=]/);
  });
});
