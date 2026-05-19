/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #13 — ludwitt finalize-token route.
 */
import { POST } from "@/app/api/ludwitt/finalize-token/route";
import { LUDWITT_FINALIZE_COOKIE } from "@/lib/ludwitt-config";
import { NextRequest } from "next/server";

jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_config: unknown, handler: (req: unknown) => unknown) => handler,
  rateLimitConfigs: { standard: {} },
}));

function makeReq(cookieValue: string | null) {
  const headers = new Headers();
  if (cookieValue !== null) {
    headers.set("cookie", `${LUDWITT_FINALIZE_COOKIE}=${cookieValue}`);
  }
  return new NextRequest("https://example.com/api/ludwitt/finalize-token", {
    method: "POST",
    headers,
  });
}

describe("POST /api/ludwitt/finalize-token", () => {
  it("returns 410 when finalize cookie is missing", async () => {
    const res = await POST(makeReq(null));
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("expired");
  });

  it("returns the token from the cookie and clears it on success", async () => {
    const res = await POST(makeReq("the-token"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe("the-token");
    // Cookie cleared via maxAge=0
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain(LUDWITT_FINALIZE_COOKIE);
    expect(setCookie.toLowerCase()).toContain("max-age=0");
  });
});
