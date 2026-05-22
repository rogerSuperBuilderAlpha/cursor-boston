/**
 * @jest-environment node
 */

import { getClientIp } from "@/lib/client-ip";

function requestWithHeaders(headers: Record<string, string>, ip?: string): Request {
  const request = new Request("https://example.com/api/x", { headers });
  if (ip !== undefined) {
    Object.defineProperty(request, "ip", {
      configurable: true,
      value: ip,
    });
  }
  return request;
}

describe("getClientIp", () => {
  const originalTrustedProxyHops = process.env.TRUSTED_PROXY_HOPS;

  beforeEach(() => {
    delete process.env.TRUSTED_PROXY_HOPS;
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (originalTrustedProxyHops === undefined) {
      delete process.env.TRUSTED_PROXY_HOPS;
    } else {
      process.env.TRUSTED_PROXY_HOPS = originalTrustedProxyHops;
    }
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it("prefers x-vercel-forwarded-for over spoofable x-forwarded-for", () => {
    const request = requestWithHeaders({
      "x-vercel-forwarded-for": "198.51.100.10",
      "x-forwarded-for": "203.0.113.200, 10.0.0.1",
    });

    expect(getClientIp(request)).toBe("198.51.100.10");
  });

  it("uses the one-hop proxy observation instead of a client-supplied spoof", () => {
    const request = requestWithHeaders({
      "x-forwarded-for": "203.0.113.200, 198.51.100.10",
    });

    expect(getClientIp(request)).toBe("198.51.100.10");
  });

  it("uses the only XFF value for a one-hop direct request", () => {
    const request = requestWithHeaders({
      "x-forwarded-for": "198.51.100.10",
    });

    expect(getClientIp(request)).toBe("198.51.100.10");
  });

  it("uses the inner proxy observation with two trusted proxy hops", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    const request = requestWithHeaders({
      "x-forwarded-for": "203.0.113.200, 198.51.100.10, 10.0.0.1",
    });

    expect(getClientIp(request)).toBe("198.51.100.10");
  });

  it("uses the only IPv6 XFF value for a one-hop direct request", () => {
    const request = requestWithHeaders({
      "x-forwarded-for": "2001:db8::1",
    });

    expect(getClientIp(request)).toBe("2001:db8::1");
  });

  it("normalizes bracketed IPv6 addresses", () => {
    const request = requestWithHeaders({
      "x-forwarded-for": "[2001:db8::2]",
    });

    expect(getClientIp(request)).toBe("2001:db8::2");
  });

  it("does not split inside IPv6 addresses when parsing a two-hop XFF chain", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    const request = requestWithHeaders({
      "x-forwarded-for": "2001:db8::1, 10.0.0.1",
    });

    expect(getClientIp(request)).toBe("2001:db8::1");
  });

  it("falls back to cf-connecting-ip for Cloudflare direct traffic", () => {
    const request = requestWithHeaders({
      "cf-connecting-ip": "192.0.2.9",
    });

    expect(getClientIp(request)).toBe("192.0.2.9");
  });

  it("falls back to request.ip for local development when headers are absent", () => {
    const request = requestWithHeaders({}, "127.0.0.1");

    expect(getClientIp(request)).toBe("127.0.0.1");
  });

  it("returns unknown when no trusted source is present", () => {
    const request = requestWithHeaders({});

    expect(getClientIp(request)).toBe("unknown");
  });

  it("ignores x-real-ip because clients can spoof it on raw Node requests", () => {
    const request = requestWithHeaders({
      "x-real-ip": "198.51.100.99",
    });

    expect(getClientIp(request)).toBe("unknown");
  });

  it("falls back to one trusted hop when TRUSTED_PROXY_HOPS is malformed", () => {
    process.env.TRUSTED_PROXY_HOPS = "nope";
    const request = requestWithHeaders({
      "x-forwarded-for": "203.0.113.200, 198.51.100.10",
    });

    expect(getClientIp(request)).toBe("198.51.100.10");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Ignoring invalid TRUSTED_PROXY_HOPS")
    );
  });

  it("falls back to one trusted hop when TRUSTED_PROXY_HOPS is out of range", () => {
    process.env.TRUSTED_PROXY_HOPS = "99";
    const request = requestWithHeaders({
      "x-forwarded-for": "203.0.113.200, 198.51.100.10",
    });

    expect(getClientIp(request)).toBe("198.51.100.10");
  });
});
