/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { logger } from "@/lib/logger";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import {
  LUDWITT_FINALIZE_COOKIE,
  LUDWITT_LINK_UID_COOKIE,
  LUDWITT_PKCE_COOKIE,
  LUDWITT_RETURN_TO_COOKIE,
  LUDWITT_STATE_COOKIE,
  LUDWITT_TOKEN_URL,
  LUDWITT_USERINFO_URL,
  fetchLudwittWithTimeout,
  getLudwittClientId,
  getLudwittClientSecret,
  getLudwittRedirectUri,
} from "@/lib/ludwitt-config";
import { saveLudwittTokens, type LudwittTokenResponse } from "@/lib/ludwitt-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LudwittUserInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

function sanitizeReturnTo(value: string | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function clearOauthCookies(response: NextResponse) {
  response.cookies.set(LUDWITT_STATE_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(LUDWITT_PKCE_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(LUDWITT_RETURN_TO_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(LUDWITT_LINK_UID_COOKIE, "", { maxAge: 0, path: "/" });
}

function redirectError(
  request: NextRequest,
  message: string,
  options?: { connectReturnTo?: string | null }
): NextResponse {
  const target =
    options?.connectReturnTo ??
    `/login?ludwitt=error&message=${encodeURIComponent(message)}`;
  // For connect-mode (returnTo provided), append the error to the returnTo URL
  // so the page that initiated the link can render a banner.
  const url = options?.connectReturnTo
    ? `${target}${target.includes("?") ? "&" : "?"}ludwitt=error&message=${encodeURIComponent(message)}`
    : target;
  const response = NextResponse.redirect(new URL(url, request.url));
  clearOauthCookies(response);
  return response;
}

async function resolveFirebaseUid(args: {
  email: string;
  name?: string;
  picture?: string;
}): Promise<string> {
  const adminAuth = getAdminAuth();
  if (!adminAuth) throw new Error("admin_auth_unavailable");
  try {
    const existing = await adminAuth.getUserByEmail(args.email);
    return existing.uid;
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code !== "auth/user-not-found") throw e;
  }
  const created = await adminAuth.createUser({
    email: args.email,
    emailVerified: true,
    displayName: args.name,
    photoURL: args.picture,
  });
  return created.uid;
}

async function handleLudwittCallback(request: NextRequest): Promise<NextResponse> {
  const sp = request.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const providerError = sp.get("error");

  const expectedState = request.cookies.get(LUDWITT_STATE_COOKIE)?.value;
  const verifier = request.cookies.get(LUDWITT_PKCE_COOKIE)?.value;
  const returnTo = sanitizeReturnTo(
    request.cookies.get(LUDWITT_RETURN_TO_COOKIE)?.value
  );
  const linkUid = request.cookies.get(LUDWITT_LINK_UID_COOKIE)?.value;
  const isConnectFlow = Boolean(linkUid);
  const errorOpts = isConnectFlow
    ? { connectReturnTo: returnTo || "/profile" }
    : undefined;

  if (providerError) return redirectError(request, providerError, errorOpts);
  if (!code || !state) return redirectError(request, "missing_params", errorOpts);
  if (!expectedState || expectedState !== state)
    return redirectError(request, "invalid_state", errorOpts);
  if (!verifier) return redirectError(request, "invalid_state", errorOpts);

  const clientId = getLudwittClientId();
  const clientSecret = getLudwittClientSecret();
  if (!clientId || !clientSecret) {
    logger.error("Ludwitt OAuth not configured");
    return redirectError(request, "not_configured", errorOpts);
  }

  const redirectUri = getLudwittRedirectUri(request);

  // 1. Exchange code for tokens
  let tokens: LudwittTokenResponse;
  try {
    const tokenRes = await fetchLudwittWithTimeout(LUDWITT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: verifier,
      }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => "");
      logger.warn("Ludwitt token exchange failed", {
        status: tokenRes.status,
        body: body.slice(0, 300),
      });
      return redirectError(request, "token_failed", errorOpts);
    }
    tokens = (await tokenRes.json()) as LudwittTokenResponse;
  } catch (err) {
    logger.logError(err, { stage: "token_exchange" });
    return redirectError(request, "token_failed", errorOpts);
  }

  // 2. Fetch userinfo
  let userinfo: LudwittUserInfo;
  try {
    const uiRes = await fetchLudwittWithTimeout(LUDWITT_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!uiRes.ok) {
      logger.warn("Ludwitt userinfo failed", { status: uiRes.status });
      return redirectError(request, "userinfo_failed", errorOpts);
    }
    userinfo = (await uiRes.json()) as LudwittUserInfo;
  } catch (err) {
    logger.logError(err, { stage: "userinfo" });
    return redirectError(request, "userinfo_failed", errorOpts);
  }

  if (!userinfo.email) {
    return redirectError(request, "no_email", errorOpts);
  }

  // 3. Resolve target Firebase uid:
  //    - Connect flow: link to the already-signed-in user (uid from cookie)
  //    - Sign-in flow: silent merge by email (or createUser)
  let uid: string;
  try {
    if (isConnectFlow && linkUid) {
      const adminAuth = getAdminAuth();
      if (!adminAuth) throw new Error("admin_auth_unavailable");
      // Validate the cookie-borne uid actually exists. Throws if missing.
      await adminAuth.getUser(linkUid);
      uid = linkUid;
    } else {
      uid = await resolveFirebaseUid({
        email: userinfo.email,
        name: userinfo.name,
        picture: userinfo.picture,
      });
    }
  } catch (err) {
    logger.logError(err, { stage: "firebase_user", email: userinfo.email });
    return redirectError(request, "firebase_user_failed", errorOpts);
  }

  // 4. Persist tokens (server-only) + identity (public-safe)
  const db = getAdminDb();
  if (!db) return redirectError(request, "not_configured", errorOpts);
  try {
    await saveLudwittTokens(uid, tokens);
    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          ludwitt: {
            sub: userinfo.sub,
            email: userinfo.email,
            name: userinfo.name ?? null,
            picture: userinfo.picture ?? null,
            scope: tokens.scope,
            connectedAt: FieldValue.serverTimestamp(),
            lastSignInAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
  } catch (err) {
    logger.logError(err, { stage: "persist_tokens", uid });
    return redirectError(request, "token_persist_failed", errorOpts);
  }

  // 5. Connect flow: user is already signed in. Skip custom-token mint and
  // redirect straight to returnTo with a success indicator.
  if (isConnectFlow) {
    const target = returnTo || "/profile";
    const url = new URL(
      `${target}${target.includes("?") ? "&" : "?"}ludwitt=success`,
      request.url
    );
    const response = NextResponse.redirect(url);
    clearOauthCookies(response);
    return response;
  }

  // 6. Sign-in flow: mint Firebase custom token and hand to finalize page.
  let customToken: string;
  try {
    const adminAuth = getAdminAuth();
    if (!adminAuth) throw new Error("admin_auth_unavailable");
    customToken = await adminAuth.createCustomToken(uid, {
      ludwitt_sub: userinfo.sub,
    });
  } catch (err) {
    logger.logError(err, { stage: "custom_token", uid });
    return redirectError(request, "custom_token_failed", errorOpts);
  }

  const finalizeUrl = new URL("/auth/ludwitt-finalize", request.url);
  if (returnTo) finalizeUrl.searchParams.set("returnTo", returnTo);
  const response = NextResponse.redirect(finalizeUrl);
  clearOauthCookies(response);
  response.cookies.set(LUDWITT_FINALIZE_COOKIE, customToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 120,
  });

  return response;
}

export const GET = withMiddleware(rateLimitConfigs.oauthCallback, handleLudwittCallback);
