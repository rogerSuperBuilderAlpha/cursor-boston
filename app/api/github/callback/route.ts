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

async function handleGitHubCallback(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("github_oauth_state")?.value;

  if (!code || !state) {
    return NextResponse.redirect(new URL("/profile?github=error&message=missing_params", request.url));
  }

  if (!expectedState || expectedState !== state) {
    logger.warn("GitHub OAuth state mismatch", { endpoint: "/api/github/callback" });
    const response = NextResponse.redirect(
      new URL("/profile?github=error&message=invalid_state", request.url)
    );
    response.cookies.set("github_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  }

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    logger.error("GitHub OAuth not properly configured. Missing required environment variables.");
    return NextResponse.redirect(new URL("/profile?github=error&message=not_configured", request.url));
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
      return NextResponse.redirect(new URL("/profile?github=error&message=token_failed", request.url));
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      logger.error("GitHub OAuth error", {
        error: tokenData.error,
        error_description: tokenData.error_description,
        error_uri: tokenData.error_uri,
        redirect_uri_used: redirectUri,
      });
      return NextResponse.redirect(new URL("/profile?github=error&message=token_failed", request.url));
    }

    // Get user info from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      logger.error("GitHub user fetch failed", { status: userResponse.status });
      return NextResponse.redirect(new URL("/profile?github=error&message=user_fetch_failed", request.url));
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

    const response = NextResponse.redirect(
      new URL(`/profile?github=success&data=${githubData}`, request.url)
    );
    response.cookies.set("github_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/github/callback",
      method: "GET",
    });
    const response = NextResponse.redirect(
      new URL("/profile?github=error&message=unknown", request.url)
    );
    response.cookies.set("github_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  }
}

// Apply rate limiting and logging middleware
export const GET = withMiddleware(
  rateLimitConfigs.oauthCallback,
  handleGitHubCallback
);
