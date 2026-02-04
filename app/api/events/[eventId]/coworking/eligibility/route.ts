import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkCoworkingEligibility } from "@/lib/coworking";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 30 };

/**
 * GET /api/events/[eventId]/coworking/eligibility
 * Check if the authenticated user is eligible to register for coworking.
 * Requirements: registered, public profile, GitHub connected.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`coworking-eligibility:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json(
        { eligible: false, reason: "Please sign in to register for coworking." },
        { status: 200 }
      );
    }

    const result = await checkCoworkingEligibility(user.uid);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[coworking/eligibility]", error);
    return NextResponse.json(
      { eligible: false, reason: "Could not check eligibility." },
      { status: 200 }
    );
  }
}
