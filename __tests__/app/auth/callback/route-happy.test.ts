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

const mockFetchLudwitt = jest.fn();
const mockGetClientId = jest.fn(() => "client-id");
const mockGetClientSecret = jest.fn(() => "client-secret");

jest.mock("@/lib/ludwitt-config", () => ({
  LUDWITT_STATE_COOKIE: "ludwitt_state",
  LUDWITT_PKCE_COOKIE: "ludwitt_pkce",
  LUDWITT_RETURN_TO_COOKIE: "ludwitt_return_to",
  LUDWITT_LINK_UID_COOKIE: "ludwitt_link_uid",
  LUDWITT_FINALIZE_COOKIE: "ludwitt_finalize",
  LUDWITT_TOKEN_URL: "https://ludwitt.example/token",
  LUDWITT_USERINFO_URL: "https://ludwitt.example/userinfo",
  fetchLudwittWithTimeout: (...args: unknown[]) => mockFetchLudwitt(...args),
  getLudwittClientId: () => mockGetClientId(),
  getLudwittClientSecret: () => mockGetClientSecret(),
  getLudwittRedirectUri: jest.fn(() => "http://localhost:3000/auth/callback"),
}));

jest.mock("@/lib/ludwitt-tokens", () => ({
  saveLudwittTokens: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: jest.fn(() => ({
    getUserByEmail: jest.fn().mockResolvedValue({ uid: "firebase-u1" }),
    createCustomToken: jest.fn().mockResolvedValue("custom-token-xyz"),
  })),
  getAdminDb: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      })),
    })),
  })),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/auth/callback/route";
import { saveLudwittTokens } from "@/lib/ludwitt-tokens";

describe("GET /auth/callback happy path", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchLudwitt
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: "lud-1",
          email: "user@example.com",
          name: "User",
        }),
      });
  });

  it("redirects to ludwitt-finalize with custom token cookie", async () => {
    const req = new NextRequest(
      "http://localhost:3000/auth/callback?code=abc&state=ok",
    );
    req.cookies.set("ludwitt_state", "ok");
    req.cookies.set("ludwitt_pkce", "verifier");

    const res = await GET!(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/ludwitt-finalize");
    expect(saveLudwittTokens).toHaveBeenCalledWith(
      "firebase-u1",
      expect.objectContaining({ access_token: "at" }),
    );
  });
});
