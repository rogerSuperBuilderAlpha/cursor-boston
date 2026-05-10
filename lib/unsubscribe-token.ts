/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { createHmac } from "crypto";

const SECRET =
  process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || "cursor-boston-unsub";

/** Generate a deterministic HMAC token for an email address. */
export function generateUnsubscribeToken(email: string): string {
  return createHmac("sha256", SECRET)
    .update(email.toLowerCase().trim())
    .digest("hex");
}

/** Verify that a token matches the expected HMAC for the email. */
export function verifyUnsubscribeToken(
  email: string,
  token: string
): boolean {
  const expected = generateUnsubscribeToken(email);
  return expected === token;
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
  return generateWithdrawToken(email, cohortId) === token;
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
