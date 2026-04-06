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
