import { NextRequest, NextResponse } from "next/server";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { logger } from "@/lib/logger";

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
// NOTE: Replace with your actual domain in .env.local
// This must match the Authorization callback URL configured in your GitHub OAuth app
const GITHUB_REDIRECT_URI = process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI;

async function handleGitHubCallback(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // Contains the Firebase UID

  if (!code || !state) {
    return NextResponse.redirect(new URL("/profile?github=error&message=missing_params", request.url));
  }

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !GITHUB_REDIRECT_URI) {
    logger.error("GitHub OAuth not properly configured. Missing required environment variables.");
    return NextResponse.redirect(new URL("/profile?github=error&message=not_configured", request.url));
  }

  try {
    // Exchange code for access token
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
        redirect_uri: GITHUB_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      // Log error without exposing sensitive data
      logger.error("GitHub token exchange failed", { status: tokenResponse.status });
      return NextResponse.redirect(new URL("/profile?github=error&message=token_failed", request.url));
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      logger.error("GitHub OAuth error", { error: tokenData.error_description || tokenData.error });
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

    return NextResponse.redirect(
      new URL(`/profile?github=success&data=${githubData}&uid=${state}`, request.url)
    );
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/github/callback",
      method: "GET",
    });
    return NextResponse.redirect(new URL("/profile?github=error&message=unknown", request.url));
  }
}

// Apply rate limiting and logging middleware
export const GET = withMiddleware(
  rateLimitConfigs.oauthCallback,
  handleGitHubCallback
);
