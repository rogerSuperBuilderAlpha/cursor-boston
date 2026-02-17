import { NextRequest, NextResponse } from "next/server";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { logger } from "@/lib/logger";

const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI_ENV = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI;
const DISCORD_SERVER_ID = process.env.CURSOR_BOSTON_DISCORD_SERVER_ID;

function getDiscordRedirectUri(request: NextRequest): string {
  if (DISCORD_REDIRECT_URI_ENV) {
    return DISCORD_REDIRECT_URI_ENV;
  }
  const url = new URL(request.url);
  return `${url.origin}/api/discord/callback`;
}

async function handleDiscordCallback(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("discord_oauth_state")?.value;

  if (!code || !state) {
    return NextResponse.redirect(new URL("/profile?discord=error&message=missing_params", request.url));
  }

  if (!expectedState || expectedState !== state) {
    logger.warn("Discord OAuth state mismatch", { endpoint: "/api/discord/callback" });
    const response = NextResponse.redirect(
      new URL("/profile?discord=error&message=invalid_state", request.url)
    );
    response.cookies.set("discord_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  }

  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_SERVER_ID) {
    logger.error("Discord OAuth not properly configured. Missing required environment variables.");
    return NextResponse.redirect(new URL("/profile?discord=error&message=not_configured", request.url));
  }

  const redirectUri = getDiscordRedirectUri(request);

  try {
    // Exchange code for access token
    logger.info("Discord token exchange", { redirect_uri: redirectUri });
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
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
      return NextResponse.redirect(new URL("/profile?discord=error&message=token_failed", request.url));
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Discord
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      logger.error("Discord user fetch failed", { status: userResponse.status });
      return NextResponse.redirect(new URL("/profile?discord=error&message=user_fetch_failed", request.url));
    }

    const discordUser = await userResponse.json();

    // Check if user is a member of the Cursor Boston Discord server
    const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!guildsResponse.ok) {
      logger.error("Discord guilds fetch failed", { status: guildsResponse.status });
      return NextResponse.redirect(new URL("/profile?discord=error&message=guilds_fetch_failed", request.url));
    }

    const guilds = await guildsResponse.json();
    const isMember = guilds.some((guild: { id: string }) => guild.id === DISCORD_SERVER_ID);

    if (!isMember) {
      // User is not a member of the Cursor Boston Discord
      return NextResponse.redirect(new URL("/profile?discord=error&message=not_member", request.url));
    }

    // Return success with Discord user data encoded in URL
    // The client-side will handle saving to Firestore
    const discordData = encodeURIComponent(JSON.stringify({
      id: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.global_name,
      avatar: discordUser.avatar,
    }));

    const response = NextResponse.redirect(
      new URL(`/profile?discord=success&data=${discordData}`, request.url)
    );
    response.cookies.set("discord_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/discord/callback",
      method: "GET",
    });
    const response = NextResponse.redirect(
      new URL("/profile?discord=error&message=unknown", request.url)
    );
    response.cookies.set("discord_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  }
}

// Apply rate limiting and logging middleware
export const GET = withMiddleware(
  rateLimitConfigs.oauthCallback,
  handleDiscordCallback
);
