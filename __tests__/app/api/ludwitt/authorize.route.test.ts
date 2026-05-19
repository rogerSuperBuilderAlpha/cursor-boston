/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #15 — ludwitt authorize (OAuth init).
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/ludwitt/authorize/route";
import {
  getLudwittClientId,
  getLudwittRedirectUri,
  LUDWITT_AUTHORIZE_URL,
  LUDWITT_STATE_COOKIE,
  LUDWITT_PKCE_COOKIE,
  LUDWITT_RETURN_TO_COOKIE,
} from "@/lib/ludwitt-config";

jest.mock("@/lib/ludwitt-config", () => {
  const actual = jest.requireActual("@/lib/ludwitt-config");
  return {
    ...actual,
    getLudwittClientId: jest.fn(),
    getLudwittRedirectUri: jest.fn(),
  };
});

const mockClientId = getLudwittClientId as jest.MockedFunction<typeof getLudwittClientId>;
const mockRedirectUri = getLudwittRedirectUri as jest.MockedFunction<typeof getLudwittRedirectUri>;

function makeReq(url: string) {
  return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockClientId.mockReturnValue("lc-1");
  mockRedirectUri.mockReturnValue("https://example.com/api/ludwitt/callback");
});

describe("GET /api/ludwitt/authorize", () => {
  it("redirects to login error page when client_id missing", async () => {
    mockClientId.mockReturnValue(null);
    const res = await GET(makeReq("https://example.com/api/ludwitt/authorize"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("ludwitt=error&message=not_configured");
  });

  it("redirects to Ludwitt authorize URL with all OAuth params + PKCE", async () => {
    const res = await GET(makeReq("https://example.com/api/ludwitt/authorize"));
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") || "";
    expect(loc.startsWith(LUDWITT_AUTHORIZE_URL)).toBe(true);
    expect(loc).toContain("client_id=lc-1");
    expect(loc).toContain("response_type=code");
    expect(loc).toContain("code_challenge_method=S256");
    expect(loc).toMatch(/code_challenge=[A-Za-z0-9_-]{20,}/);
    expect(loc).toMatch(/state=[A-Za-z0-9_-]{40,}/);
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain(LUDWITT_STATE_COOKIE);
    expect(setCookie).toContain(LUDWITT_PKCE_COOKIE);
  });

  it("sets return_to cookie for safe relative returnTo", async () => {
    const res = await GET(
      makeReq("https://example.com/api/ludwitt/authorize?returnTo=/profile"),
    );
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain(LUDWITT_RETURN_TO_COOKIE);
  });

  it("rejects open-redirect returnTo (starts with //)", async () => {
    const res = await GET(
      makeReq("https://example.com/api/ludwitt/authorize?returnTo=//evil.com"),
    );
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).not.toContain(LUDWITT_RETURN_TO_COOKIE);
  });

  it("rejects absolute-URL returnTo", async () => {
    const res = await GET(
      makeReq("https://example.com/api/ludwitt/authorize?returnTo=https://evil"),
    );
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).not.toContain(LUDWITT_RETURN_TO_COOKIE);
  });

  it("does not set return_to cookie when returnTo is absent", async () => {
    const res = await GET(makeReq("https://example.com/api/ludwitt/authorize"));
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).not.toContain(LUDWITT_RETURN_TO_COOKIE);
  });
});
