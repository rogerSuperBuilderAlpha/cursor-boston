/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { createHmac } from "crypto";

const SECRET =
  process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || "cursor-boston-unsub";

/**
 * Deterministic HMAC-SHA256 token for an email (one-click unsubscribe links).
 *
 * @param email - Address to sign (normalized to lower-case trimmed).
 * @returns Hex digest used as `token` query param.
 */
export function generateUnsubscribeToken(email: string): string {
  return createHmac("sha256", SECRET)
    .update(email.toLowerCase().trim())
    .digest("hex");
}

/**
 * Verify that a token matches the expected HMAC for the email. 
 *
 * @param email - Same normalization as when the token was generated.
 * @param token - Client-supplied hex digest.
 * @returns `true` if the token matches.
 */
export function verifyUnsubscribeToken(
  email: string,
  token: string
): boolean {
  const expected = generateUnsubscribeToken(email);
  return expected === token;
}

/**
 * Build an unsubscribe URL with signed `email` and `token` query params.
 *
 * @param email - Subscriber address.
 * @returns URL under `NEXT_PUBLIC_APP_URL` (or production default).
 */
export function buildUnsubscribeUrl(email: string): string {
  const origin =
    (process.env.NEXT_PUBLIC_APP_URL || "https://cursorboston.com").replace(
      /\/$/,
      ""
    );
  const token = generateUnsubscribeToken(email);
  return `${origin}/api/notifications/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}
