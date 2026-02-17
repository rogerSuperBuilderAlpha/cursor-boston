import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
const GITHUB_REDIRECT_URI_ENV = process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI;

function getGitHubRedirectUri(request: NextRequest): string {
  if (GITHUB_REDIRECT_URI_ENV) {
    return GITHUB_REDIRECT_URI_ENV;
  }
  const url = new URL(request.url);
  return `${url.origin}/api/github/callback`;
}

export async function GET(request: NextRequest) {
  if (!GITHUB_CLIENT_ID) {
    return NextResponse.redirect(
      new URL("/profile?github=error&message=not_configured", request.url)
    );
  }

  const redirectUri = getGitHubRedirectUri(request);
  const state = randomBytes(32).toString("base64url");
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "read:user",
    state,
  });

  const response = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  );

  response.cookies.set("github_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
