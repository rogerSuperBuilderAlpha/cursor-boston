/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  LUDWITT_AUTHORIZE_URL,
  LUDWITT_PKCE_COOKIE,
  LUDWITT_RETURN_TO_COOKIE,
  LUDWITT_SCOPES,
  LUDWITT_STATE_COOKIE,
  getLudwittClientId,
  getLudwittRedirectUri,
} from "@/lib/ludwitt-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeReturnTo(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function GET(request: NextRequest) {
  const clientId = getLudwittClientId();
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/login?ludwitt=error&message=not_configured", request.url)
    );
  }

  const redirectUri = getLudwittRedirectUri(request);
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: LUDWITT_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(
    `${LUDWITT_AUTHORIZE_URL}?${params.toString()}`
  );

  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  };

  response.cookies.set(LUDWITT_STATE_COOKIE, state, cookieOpts);
  response.cookies.set(LUDWITT_PKCE_COOKIE, verifier, cookieOpts);
  if (returnTo) {
    response.cookies.set(LUDWITT_RETURN_TO_COOKIE, returnTo, cookieOpts);
  }

  return response;
}
