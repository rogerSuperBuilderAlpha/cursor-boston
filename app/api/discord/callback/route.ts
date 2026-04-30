/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { logger } from "@/lib/logger";

const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI_ENV = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI;
const DISCORD_SERVER_ID = process.env.CURSOR_BOSTON_DISCORD_SERVER_ID;

const DISCORD_API_TIMEOUT_MS = 10_000; // 10 second timeout for Discord API calls

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCORD_API_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function getDiscordRedirectUri(request: NextRequest): string {
  if (DISCORD_REDIRECT_URI_ENV) {
    return DISCORD_REDIRECT_URI_ENV;
  }
  const url = new URL(request.url);
  return `${url.origin}/api/discord/callback`;
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
  response.cookies.set("discord_oauth_state", "", { maxAge: 0, path: "/" });
  response.cookies.set("discord_oauth_return_to", "", { maxAge: 0, path: "/" });
  return response;
}

async function handleDiscordCallback(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("discord_oauth_state")?.value;
  const returnTo = sanitizeReturnTo(
    request.cookies.get("discord_oauth_return_to")?.value
  );

  if (!code || !state) {
    return buildCallbackRedirect(request, returnTo, "discord=error&message=missing_params");
  }

  if (!expectedState || expectedState !== state) {
    logger.warn("Discord OAuth state mismatch", { endpoint: "/api/discord/callback" });
    return buildCallbackRedirect(request, returnTo, "discord=error&message=invalid_state");
  }

  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_SERVER_ID) {
    logger.error("Discord OAuth not properly configured. Missing required environment variables.");
    return buildCallbackRedirect(request, returnTo, "discord=error&message=not_configured");
  }

  const redirectUri = getDiscordRedirectUri(request);

  try {
    // Exchange code for access token
    logger.info("Discord token exchange", { redirect_uri: redirectUri });
    const tokenResponse = await fetchWithTimeout("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error("Discord token exchange failed", { status: tokenResponse.status, body: errorText, redirect_uri: redirectUri });
      return buildCallbackRedirect(request, returnTo, "discord=error&message=token_failed");
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Discord
    const userResponse = await fetchWithTimeout("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      logger.error("Discord user fetch failed", { status: userResponse.status });
      return buildCallbackRedirect(request, returnTo, "discord=error&message=user_fetch_failed");
    }

    const discordUser = await userResponse.json();

    // Check if user is a member of the Cursor Boston Discord server
    const guildsResponse = await fetchWithTimeout("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!guildsResponse.ok) {
      logger.error("Discord guilds fetch failed", { status: guildsResponse.status });
      return buildCallbackRedirect(request, returnTo, "discord=error&message=guilds_fetch_failed");
    }

    const guilds = await guildsResponse.json();
    const isMember = guilds.some((guild: { id: string }) => guild.id === DISCORD_SERVER_ID);

    if (!isMember) {
      // User is not a member of the Cursor Boston Discord
      return buildCallbackRedirect(request, returnTo, "discord=error&message=not_member");
    }

    // Return success with Discord user data encoded in URL
    // The client-side will handle saving to Firestore
    const discordData = encodeURIComponent(JSON.stringify({
      id: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.global_name,
      avatar: discordUser.avatar,
    }));

    return buildCallbackRedirect(request, returnTo, `discord=success&data=${discordData}`);
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/discord/callback",
      method: "GET",
    });
    return buildCallbackRedirect(request, returnTo, "discord=error&message=unknown");
  }
}

// Apply rate limiting and logging middleware
export const GET = withMiddleware(
  rateLimitConfigs.oauthCallback,
  handleDiscordCallback
);
