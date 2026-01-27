import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  processPullRequest,
} from "@/lib/github";
import { notifyPROpened, notifyPRMerged } from "@/lib/discord";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { logger } from "@/lib/logger";
import { getClientIdentifier } from "@/lib/rate-limit";

// Disable body parsing to get raw body for signature verification
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleWebhook(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("x-hub-signature-256");

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      logger.warn("Invalid webhook signature - unauthorized request", {
        endpoint: "/api/github/webhook",
        ip: getClientIdentifier(request as unknown as Request),
      });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (parseError) {
      logger.error("Failed to parse webhook payload", {
        endpoint: "/api/github/webhook",
        error: parseError,
      });
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    const eventType = request.headers.get("x-github-event");

    // Only process pull_request events
    if (eventType !== "pull_request") {
      return NextResponse.json({ received: true, event: eventType });
    }

    const action = payload.action;
    const pr = payload.pull_request;

    // Validate required PR data
    if (!pr || !pr.number || !pr.user || !payload.repository) {
      logger.warn("Missing required PR data in webhook payload", {
        endpoint: "/api/github/webhook",
        eventType,
      });
      return NextResponse.json(
        { error: "Invalid payload structure" },
        { status: 400 }
      );
    }

    // Process pull request events (opened, closed, synchronize, reopened)
    // We track all PR states, but only count merged PRs toward user stats
    if (
      action === "opened" ||
      action === "closed" ||
      action === "synchronize" ||
      action === "reopened"
    ) {
      try {
        await processPullRequest({
          number: pr.number,
          title: pr.title || "Untitled",
          state: pr.state,
          merged: pr.merged || false, // Boolean indicating if PR was merged
          user: pr.user,
          html_url: pr.html_url,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          merged_at: pr.merged_at,
          repository: payload.repository,
        });

        // Send Discord notifications for PR events
        const repository = `${payload.repository.owner.login}/${payload.repository.name}`;
        const notificationData = {
          number: pr.number,
          title: pr.title || "Untitled",
          authorLogin: pr.user.login,
          authorAvatarUrl: pr.user.avatar_url,
          url: pr.html_url,
          repository,
        };

        if (action === "opened") {
          // Notify Discord when a new PR is opened
          await notifyPROpened(notificationData);
        } else if (action === "closed" && pr.merged) {
          // Notify Discord when a PR is merged
          await notifyPRMerged({
            ...notificationData,
            mergedAt: pr.merged_at,
          });
        }
      } catch (processError) {
        logger.logError(processError, {
          endpoint: "/api/github/webhook",
          action,
          prNumber: pr.number,
        });
        // Don't fail the webhook, but log the error
        return NextResponse.json(
          { received: true, action, error: "Failed to process PR" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ received: true, action });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/github/webhook",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply rate limiting and logging middleware
export const POST = withMiddleware(
  rateLimitConfigs.webhook,
  handleWebhook
);

// GitHub sends a ping event when you create a webhook
export async function GET() {
  return NextResponse.json({ status: "ok", message: "GitHub webhook endpoint is active" });
}
