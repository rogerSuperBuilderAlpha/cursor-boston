/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

const DEFAULT_TRUSTED_PROXY_HOPS = 1;
const MAX_TRUSTED_PROXY_HOPS = 10;

let warnedInvalidTrustedProxyHops = false;

type RequestWithOptionalIp = Request & {
  ip?: string | null;
};

function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}

function normalizeIp(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function getTrustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS?.trim();
  if (!raw) return DEFAULT_TRUSTED_PROXY_HOPS;

  const parsed = Number(raw);
  if (
    !Number.isInteger(parsed) ||
    parsed < 0 ||
    parsed > MAX_TRUSTED_PROXY_HOPS
  ) {
    if (!warnedInvalidTrustedProxyHops) {
      warnedInvalidTrustedProxyHops = true;
      console.warn(
        `Ignoring invalid TRUSTED_PROXY_HOPS=${JSON.stringify(raw)}; using ${DEFAULT_TRUSTED_PROXY_HOPS}.`
      );
    }
    return DEFAULT_TRUSTED_PROXY_HOPS;
  }

  return parsed;
}

function ipFromForwardedFor(value: string | null): string | null {
  const addresses = value
    ?.split(",")
    .map((part) => normalizeIp(part))
    .filter((part): part is string => Boolean(part));

  if (!addresses?.length) return null;

  const trustedHops = getTrustedProxyHops();
  const selectedIndex = Math.max(0, addresses.length - trustedHops);

  return addresses[selectedIndex] ?? null;
}

/**
 * Extract the rate-limit/logging client IP from platform-controlled headers.
 *
 * Precedence is intentionally conservative:
 * - Vercel's normalized single-value forwarding header wins when present.
 * - X-Forwarded-For trusts only the right-side proxy-written suffix configured
 *   by TRUSTED_PROXY_HOPS and selects the innermost trusted observation.
 * - Cloudflare's direct connecting IP remains a supported fallback.
 * - Next/local request.ip helps local development avoid one shared bucket.
 */
export function getClientIp(request: RequestWithOptionalIp): string {
  return (
    normalizeIp(firstHeaderValue(request.headers.get("x-vercel-forwarded-for"))) ??
    ipFromForwardedFor(request.headers.get("x-forwarded-for")) ??
    normalizeIp(request.headers.get("cf-connecting-ip")) ??
    normalizeIp(request.ip) ??
    "unknown"
  );
}
