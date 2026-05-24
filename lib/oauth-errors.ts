/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Shared lookup from OAuth callback error codes (what each provider's
 * callback handler shoves into the `?<provider>=error&message=<code>`
 * query string) to user-facing copy.
 *
 * Why a shared file: both Discord and GitHub used to silently fall back
 * to "Failed to connect, please try again" for any error. After the
 * 2026-05-23 rate-limit incident at the May 26 immersion event, every
 * code now maps to a specific sentence so users know what's wrong AND
 * what they can do next.
 */

import type { ToastOptions } from "@/components/Toast";

type Provider = "Discord" | "GitHub";

interface OAuthErrorEntry {
  title: string;
  description: string;
}

const COMMON: Record<string, (provider: Provider) => OAuthErrorEntry> = {
  rate_limited: (p) => ({
    title: `Too many ${p} connect attempts`,
    description:
      "Lots of people on this network connected accounts in the last 15 minutes. Give it a few minutes and try again — your account is fine, the rate limit just resets.",
  }),
  missing_params: (p) => ({
    title: `${p} sign-in was interrupted`,
    description:
      "We didn't get the OAuth response we expected back from " +
      p +
      ". Cancelling the popup or refreshing during sign-in usually does this. Try again from scratch.",
  }),
  invalid_state: (p) => ({
    title: `${p} sign-in didn't match our session`,
    description:
      "The session token from " +
      p +
      " didn't match the one we issued — usually means you started the flow in one tab and finished it in another. Try the connect button again in this tab.",
  }),
  not_configured: (p) => ({
    title: `${p} connect isn't set up on this deploy`,
    description:
      "The server is missing the " +
      p +
      " OAuth credentials. This is a config bug on our side, not yours.",
  }),
  token_failed: (p) => ({
    title: `${p} rejected our token exchange`,
    description:
      "We sent " +
      p +
      " your auth code and it came back without a usable access token. Try again; if it keeps failing, your " +
      p +
      " account may have a security restriction.",
  }),
  user_fetch_failed: (p) => ({
    title: `Couldn't read your ${p} profile`,
    description: `${p} accepted the connection but the follow-up profile read failed. Try the connect button again.`,
  }),
  unknown: (p) => ({
    title: `Something went wrong connecting ${p}`,
    description:
      "We don't know exactly what failed. Try again, or open a new tab and start over. If it keeps happening, the link below to the repo is the fastest way to file it.",
  }),
};

const DISCORD_ONLY: Record<string, () => OAuthErrorEntry> = {
  guilds_fetch_failed: () => ({
    title: "Couldn't read your Discord servers",
    description:
      "Discord accepted the connection but we couldn't fetch your guild list to verify the cursor-boston server. Try again.",
  }),
  not_member: () => ({
    title: "You're not in the cursor-boston Discord server",
    description:
      "Join the server first, then re-run the connect flow. The link is in the event page footer.",
  }),
};

export function describeOAuthError(
  provider: Provider,
  code: string | null | undefined
): ToastOptions {
  const key = code ?? "unknown";
  if (provider === "Discord" && DISCORD_ONLY[key]) {
    return { ...DISCORD_ONLY[key](), severity: "error" };
  }
  const common = COMMON[key];
  if (common) {
    return { ...common(provider), severity: "error" };
  }
  return { ...COMMON.unknown(provider), severity: "error" };
}
