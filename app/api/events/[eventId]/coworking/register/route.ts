import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  checkCoworkingEligibility,
  getUserProfileForRegistration,
  registerForSession,
  cancelRegistration,
} from "@/lib/coworking";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeDocId } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 10 };

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

/**
 * POST /api/events/[eventId]/coworking/register
 * Register for a coworking session.
 * Body: { sessionId: string }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`coworking-register:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await context.params;
    const sanitizedEventId = sanitizeDocId(eventId);
    if (!sanitizedEventId) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    // Check eligibility
    const eligibility = await checkCoworkingEligibility(user.uid);
    if (!eligibility.eligible) {
      return NextResponse.json(
        { success: false, error: eligibility.reason },
        { status: 400 }
      );
    }

    // Get session ID from body
    const body = await request.json().catch(() => ({}));
    const sessionId = sanitizeDocId(body.sessionId);
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Get user profile
    const profile = await getUserProfileForRegistration(user.uid);
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Could not load your profile" },
        { status: 400 }
      );
    }

    // Register
    const result = await registerForSession(
      sanitizedEventId,
      sessionId,
      user.uid,
      profile
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Successfully registered for coworking session!",
      registration: result.registration,
    });
  } catch (error) {
    console.error("[coworking/register POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to register" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[eventId]/coworking/register
 * Cancel a coworking registration.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`coworking-cancel:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await context.params;
    const sanitizedEventId = sanitizeDocId(eventId);
    if (!sanitizedEventId) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const result = await cancelRegistration(sanitizedEventId, user.uid);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Registration cancelled successfully",
    });
  } catch (error) {
    console.error("[coworking/register DELETE]", error);
    return NextResponse.json(
      { success: false, error: "Failed to cancel registration" },
      { status: 500 }
    );
  }
}
