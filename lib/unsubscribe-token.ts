/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { createHmac, timingSafeEqual } from "crypto";

const DEV_TEST_SECRET = "cursor-boston-unsubscribe-dev-test-only";
const MIN_SECRET_BYTES = 32;

function readConfiguredSecret(): string | null {
  const unsubscribeSecret = process.env.UNSUBSCRIBE_SECRET?.trim();
  if (unsubscribeSecret) return unsubscribeSecret;

  return null;
}

function resolveSecret(): string {
  const configuredSecret = readConfiguredSecret();
  if (configuredSecret) {
    if (Buffer.byteLength(configuredSecret, "utf8") < MIN_SECRET_BYTES) {
      throw new Error(
        "UNSUBSCRIBE_SECRET must be at least 32 bytes; refusing to generate unsubscribe or withdraw tokens with a weak secret."
      );
    }

    return configuredSecret;
  }

  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    return DEV_TEST_SECRET;
  }

  throw new Error(
    "UNSUBSCRIBE_SECRET must be configured; refusing to generate unsubscribe or withdraw tokens with a public fallback secret."
  );
}

// Resolve the secret LAZILY, on first token operation, not at import time.
// Module imports are hoisted above any `loadEnvConfig(...)` call in a script,
// so an import-time `resolveSecret()` ran before the env was populated and
// threw — which is exactly what pushed the send scripts into a fragile
// `UNSUBSCRIBE_SECRET="$(... cut ...)"` shell prefix (whose kept quotes broke
// ~1,900 unsubscribe links). Lazy + memoized resolution lets a script call
// loadEnvConfig() first, then generate tokens with the correctly-loaded value,
// with no env shell-prefix needed. Memoized so the HMAC key is stable per run.
let cachedSecret: string | null = null;
function getSecret(): string {
  if (cachedSecret === null) cachedSecret = resolveSecret();
  return cachedSecret;
}

/** Generate a deterministic HMAC token for an email address. */
/** @internal */
export function generateUnsubscribeToken(email: string): string {
  return createHmac("sha256", getSecret())
    .update(email.toLowerCase().trim())
    .digest("hex");
}

function tokenMatches(expected: string, candidate: string): boolean {
  if (expected.length !== candidate.length) return false;

  const expectedBytes = Buffer.from(expected, "hex");
  const candidateBytes = Buffer.from(candidate, "hex");
  if (expectedBytes.length !== candidateBytes.length) return false;

  return timingSafeEqual(expectedBytes, candidateBytes);
}

// Legacy/compat secret: two send scripts in early June 2026 (the cohort-1
// Discord blast and the 2026-06-03 game digest) signed their unsubscribe
// links with the secret value INCLUDING its surrounding double-quotes — the
// send command extracted UNSUBSCRIBE_SECRET from .env.local with `cut`, which
// keeps the quotes, while the runtime (and dotenv) strip them. Those ~1,900
// already-sent links would otherwise never verify. We accept them via a
// secondary HMAC keyed on the quoted secret. This is intentionally narrow:
// it only matches tokens signed with `"<secret>"`, nothing else.
function generateLegacyQuotedToken(email: string): string {
  return createHmac("sha256", `"${getSecret()}"`)
    .update(email.toLowerCase().trim())
    .digest("hex");
}

/**
 * Verify that a token matches the expected HMAC for the email.
 *
 * Primary check uses the correctly-loaded secret. As a backward-compatible
 * fallback we also accept tokens signed with the quote-wrapped secret (see
 * LEGACY_QUOTED_SECRET) so unsubscribe links from the early-June 2026 blasts
 * keep working. Both comparisons are constant-time.
 */
export function verifyUnsubscribeToken(
  email: string,
  token: string
): boolean {
  if (tokenMatches(generateUnsubscribeToken(email), token)) return true;
  return tokenMatches(generateLegacyQuotedToken(email), token);
}

/** Build a full unsubscribe URL for a given email. */
export function buildUnsubscribeUrl(email: string): string {
  const origin =
    (process.env.NEXT_PUBLIC_APP_URL || "https://cursorboston.com").replace(
      /\/$/,
      ""
    );
  const token = generateUnsubscribeToken(email);
  return `${origin}/api/notifications/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

// HMAC namespace prefix so a withdraw token can never be replayed against the
// unsubscribe endpoint (or vice-versa) even though both share the same secret.
const WITHDRAW_NS = "withdraw-cohort";

/** @internal */
export function generateWithdrawToken(email: string, cohortId: string): string {
  return createHmac("sha256", getSecret())
    .update(`${WITHDRAW_NS}:${cohortId}:${email.toLowerCase().trim()}`)
    .digest("hex");
}

export function verifyWithdrawToken(
  email: string,
  cohortId: string,
  token: string
): boolean {
  return tokenMatches(generateWithdrawToken(email, cohortId), token);
}

export function buildWithdrawUrl(email: string, cohortId: string): string {
  const origin =
    (process.env.NEXT_PUBLIC_APP_URL || "https://cursorboston.com").replace(
      /\/$/,
      ""
    );
  const token = generateWithdrawToken(email, cohortId);
  return `${origin}/api/summer-cohort/withdraw?email=${encodeURIComponent(
    email
  )}&cohortId=${encodeURIComponent(cohortId)}&token=${token}`;
}

// Distinct namespace for the PyData May 13 withdraw flow so a token issued for
// PyData cannot be replayed against the cohort withdraw endpoint (or vice-versa).
const PYDATA_WITHDRAW_NS = "withdraw-pydata-2026";

/** @internal */
export function generatePydataWithdrawToken(email: string): string {
  return createHmac("sha256", getSecret())
    .update(`${PYDATA_WITHDRAW_NS}:${email.toLowerCase().trim()}`)
    .digest("hex");
}

export function verifyPydataWithdrawToken(email: string, token: string): boolean {
  return tokenMatches(generatePydataWithdrawToken(email), token);
}

// Builds the confirmation PAGE URL (not the API URL). The page renders an
// "Are you sure?" form that POSTs to /api/events/pydata-2026/withdraw.
export function buildPydataWithdrawUrl(email: string): string {
  const origin =
    (process.env.NEXT_PUBLIC_APP_URL || "https://cursorboston.com").replace(
      /\/$/,
      ""
    );
  const token = generatePydataWithdrawToken(email);
  return `${origin}/pydata-withdraw?email=${encodeURIComponent(email)}&token=${token}`;
}
