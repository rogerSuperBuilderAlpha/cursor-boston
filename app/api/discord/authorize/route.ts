import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
const DISCORD_REDIRECT_URI_ENV = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI;

function getDiscordRedirectUri(request: NextRequest): string {
  if (DISCORD_REDIRECT_URI_ENV) {
    return DISCORD_REDIRECT_URI_ENV;
  }
  const url = new URL(request.url);
  return `${url.origin}/api/discord/callback`;
}

export async function GET(request: NextRequest) {
  if (!DISCORD_CLIENT_ID) {
    return NextResponse.redirect(
      new URL("/profile?discord=error&message=not_configured", request.url)
    );
  }

  const redirectUri = getDiscordRedirectUri(request);
  const state = randomBytes(32).toString("base64url");
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds",
    state,
  });

  const response = NextResponse.redirect(
    `https://discord.com/api/oauth2/authorize?${params.toString()}`
  );

  response.cookies.set("discord_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
