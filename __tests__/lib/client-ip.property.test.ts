/**
 * @jest-environment node
 */

/**
 * Property-based coverage (fast-check) for getClientIp.
 *
 * Invariants under test (issue #1420):
 *  - Totality: arbitrary attacker-controlled header values never throw
 *    and always yield a non-empty string.
 *  - Precedence: a present x-vercel-forwarded-for wins over any
 *    x-forwarded-for content.
 *  - Trusted-hop selection: with the default single trusted hop, the
 *    rightmost x-forwarded-for entry (the proxy-written observation) is
 *    selected, never the client-supplied left side.
 *  - Normalization: bracketed IPv6 literals are unbracketed.
 */

import fc from "fast-check";
import { getClientIp } from "@/lib/client-ip";

function requestWithHeaders(headers: Record<string, string>): Request {
  const filtered = Object.fromEntries(
    Object.entries(headers).filter(([, value]) => value !== undefined)
  );
  return new Request("https://example.com/api/x", { headers: filtered });
}

// Header-legal arbitrary values: printable ASCII (fetch rejects other bytes).
const headerValue = fc.stringMatching(/^[\x20-\x7e]{0,120}$/);

// A single plausible IP-ish token with no comma, space, or brackets.
const ipToken = fc.oneof(
  fc.ipV4(),
  fc.ipV6().map((ip) => ip),
  fc.stringMatching(/^[a-zA-Z0-9.:_-]{1,40}$/)
);

describe("getClientIp properties", () => {
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
  });

  it("never throws and always returns a non-empty string for arbitrary header values", () => {
    fc.assert(
      fc.property(
        headerValue,
        headerValue,
        headerValue,
        (vercel, forwarded, cloudflare) => {
          const request = requestWithHeaders({
            "x-vercel-forwarded-for": vercel,
            "x-forwarded-for": forwarded,
            "cf-connecting-ip": cloudflare,
          });
          const result = getClientIp(request);
          expect(typeof result).toBe("string");
          expect(result.length).toBeGreaterThan(0);
        }
      )
    );
  });

  it("prefers x-vercel-forwarded-for over any x-forwarded-for content", () => {
    fc.assert(
      fc.property(fc.ipV4(), headerValue, (vercelIp, forwarded) => {
        const request = requestWithHeaders({
          "x-vercel-forwarded-for": vercelIp,
          "x-forwarded-for": forwarded,
        });
        expect(getClientIp(request)).toBe(vercelIp);
      })
    );
  });

  it("selects the rightmost x-forwarded-for entry under the default trusted hop", () => {
    fc.assert(
      fc.property(
        fc.array(ipToken, { minLength: 1, maxLength: 6 }),
        (addresses) => {
          const request = requestWithHeaders({
            "x-forwarded-for": addresses.join(", "),
          });
          expect(getClientIp(request)).toBe(addresses[addresses.length - 1]);
        }
      )
    );
  });

  it("unbrackets IPv6 literals from any source header", () => {
    fc.assert(
      fc.property(fc.ipV6(), (ip) => {
        const request = requestWithHeaders({
          "x-vercel-forwarded-for": `[${ip}]`,
        });
        expect(getClientIp(request)).toBe(ip);
      })
    );
  });

  it("falls back to \"unknown\" only when no header yields an address", () => {
    const request = requestWithHeaders({});
    expect(getClientIp(request)).toBe("unknown");
  });
});
