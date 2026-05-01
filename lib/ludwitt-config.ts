/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { NextRequest } from "next/server";

export const LUDWITT_AUTHORIZE_URL = "https://pitchrise.ludwitt.com/oauth/authorize";
export const LUDWITT_TOKEN_URL = "https://pitchrise.ludwitt.com/api/oauth/token";
export const LUDWITT_USERINFO_URL = "https://pitchrise.ludwitt.com/api/oauth/userinfo";
export const LUDWITT_AI_MESSAGES_URL =
  "https://pitchrise.ludwitt.com/api/v1/ai/messages";
export const LUDWITT_BALANCE_URL = "https://pitchrise.ludwitt.com/api/v1/credits/balance";
export const LUDWITT_TOPUP_URL = "https://pitchrise.ludwitt.com/account/credits";

export const LUDWITT_SCOPES = "profile credits:read credits:spend";

export const LUDWITT_TOKENS_COLLECTION = "ludwittTokens";
export const LUDWITT_FINALIZE_COOKIE = "ludwitt_finalize_token";
export const LUDWITT_STATE_COOKIE = "ludwitt_oauth_state";
export const LUDWITT_PKCE_COOKIE = "ludwitt_oauth_pkce_verifier";
export const LUDWITT_RETURN_TO_COOKIE = "ludwitt_oauth_return_to";
export const LUDWITT_LINK_UID_COOKIE = "ludwitt_oauth_link_uid";

export const LUDWITT_API_TIMEOUT_MS = 15_000;

export function getLudwittClientId(): string | null {
  return process.env.NEXT_PUBLIC_LUDWITT_CLIENT_ID || null;
}

export function getLudwittClientSecret(): string | null {
  return process.env.LUDWITT_CLIENT_SECRET || null;
}

export function getLudwittRedirectUri(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_LUDWITT_REDIRECT_URI;
  if (fromEnv) return fromEnv;
  const url = new URL(request.url);
  return `${url.origin}/auth/callback`;
}

export function fetchLudwittWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LUDWITT_API_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  );
}
