/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { logger } from "@/lib/logger";

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI_ENV = process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI;

function getGitHubRedirectUri(request: NextRequest): string {
  if (GITHUB_REDIRECT_URI_ENV) {
    return GITHUB_REDIRECT_URI_ENV;
  }
  const url = new URL(request.url);
  return `${url.origin}/api/github/callback`;
}

function sanitizeReturnTo(value: string | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function buildCallbackRedirect(
  request: NextRequest,
  returnTo: string | null,
  query: string
): NextResponse {
  const target = returnTo || "/profile";
  const separator = target.includes("?") ? "&" : "?";
  const response = NextResponse.redirect(
    new URL(`${target}${separator}${query}`, request.url)
  );
  response.cookies.set("github_oauth_state", "", { maxAge: 0, path: "/" });
  response.cookies.set("github_oauth_return_to", "", { maxAge: 0, path: "/" });
  return response;
}

async function handleGitHubCallback(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("github_oauth_state")?.value;
  const returnTo = sanitizeReturnTo(
    request.cookies.get("github_oauth_return_to")?.value
  );

  if (!code || !state) {
    return buildCallbackRedirect(request, returnTo, "github=error&message=missing_params");
  }

  if (!expectedState || expectedState !== state) {
    logger.warn("GitHub OAuth state mismatch", { endpoint: "/api/github/callback" });
    return buildCallbackRedirect(request, returnTo, "github=error&message=invalid_state");
  }

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    logger.error("GitHub OAuth not properly configured. Missing required environment variables.");
    return buildCallbackRedirect(request, returnTo, "github=error&message=not_configured");
  }

  const redirectUri = getGitHubRedirectUri(request);

  try {
    // Exchange code for access token
    logger.info("GitHub token exchange", { redirect_uri: redirectUri });
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error("GitHub token exchange failed", { status: tokenResponse.status, body: errorText });
      return buildCallbackRedirect(request, returnTo, "github=error&message=token_failed");
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      logger.error("GitHub OAuth error", {
        error: tokenData.error,
        error_description: tokenData.error_description,
        error_uri: tokenData.error_uri,
        redirect_uri_used: redirectUri,
      });
      return buildCallbackRedirect(request, returnTo, "github=error&message=token_failed");
    }

    // Get user info from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      logger.error("GitHub user fetch failed", { status: userResponse.status });
      return buildCallbackRedirect(request, returnTo, "github=error&message=user_fetch_failed");
    }

    const githubUser = await userResponse.json();

    // Return success with GitHub user data encoded in URL
    // The client-side will handle saving to Firestore
    const githubData = encodeURIComponent(JSON.stringify({
      id: githubUser.id,
      login: githubUser.login,
      name: githubUser.name,
      avatar_url: githubUser.avatar_url,
      html_url: githubUser.html_url,
    }));

    return buildCallbackRedirect(request, returnTo, `github=success&data=${githubData}`);
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/github/callback",
      method: "GET",
    });
    return buildCallbackRedirect(request, returnTo, "github=error&message=unknown");
  }
}

// Apply rate limiting and logging middleware
export const GET = withMiddleware(
  rateLimitConfigs.oauthCallback,
  handleGitHubCallback
);
