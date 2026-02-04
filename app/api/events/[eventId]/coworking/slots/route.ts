import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getSessionsWithStatus } from "@/lib/coworking";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeDocId } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 60 };

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

/**
 * GET /api/events/[eventId]/coworking/slots
 * Get all coworking sessions with availability for an event.
 * Optionally includes user's registration status if authenticated.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`coworking-slots:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const { eventId } = await context.params;
    
    // Validate eventId
    const sanitizedEventId = sanitizeDocId(eventId);
    if (!sanitizedEventId) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    // Get user if authenticated (optional)
    let userId: string | undefined;
    try {
      const user = await getVerifiedUser(request);
      userId = user?.uid;
    } catch {
      // User not authenticated, that's OK for viewing slots
    }

    const slots = await getSessionsWithStatus(sanitizedEventId, userId);

    return NextResponse.json({
      success: true,
      eventId: sanitizedEventId,
      sessions: slots,
    });
  } catch (error) {
    console.error("[coworking/slots]", error);
    return NextResponse.json(
      { error: "Failed to get coworking slots" },
      { status: 500 }
    );
  }
}
