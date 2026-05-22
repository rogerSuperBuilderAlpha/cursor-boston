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

const SECRET = resolveSecret();

/** Generate a deterministic HMAC token for an email address. */
export function generateUnsubscribeToken(email: string): string {
  return createHmac("sha256", SECRET)
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

/** Verify that a token matches the expected HMAC for the email. */
export function verifyUnsubscribeToken(
  email: string,
  token: string
): boolean {
  const expected = generateUnsubscribeToken(email);
  return tokenMatches(expected, token);
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

export function generateWithdrawToken(email: string, cohortId: string): string {
  return createHmac("sha256", SECRET)
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

export function generatePydataWithdrawToken(email: string): string {
  return createHmac("sha256", SECRET)
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
