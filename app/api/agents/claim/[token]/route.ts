import { NextRequest, NextResponse } from "next/server";
import { getAgentByClaimToken, claimAgent } from "@/lib/agents";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { logApiError } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ token: string }>;
}

// Rate limit config for claim endpoints (stricter to prevent brute-force)
const CLAIM_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 requests per 15 minutes per IP
};

/**
 * GET /api/agents/claim/[token]
 * Get information about an agent pending claim.
 * Used to display claim page with agent details.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Apply rate limiting
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateLimitResult = checkRateLimit(`agent-claim-get:${clientId}`, CLAIM_RATE_LIMIT);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests",
          retryAfterSeconds: rateLimitResult.retryAfter,
        },
        { 
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfter || 60),
          },
        }
      );
    }

    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Claim token is required",
        },
        { status: 400 }
      );
    }

    // Get agent by claim token
    const agent = await getAgentByClaimToken(token);

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired claim token",
          hint: "The agent may have already been claimed, or the claim link has expired (7 days).",
        },
        { status: 404 }
      );
    }

    // Check if user is logged in
    let user = null;
    try {
      user = await getVerifiedUser(request);
    } catch {
      // User not logged in, that's okay for GET
    }

    // Check profile requirements if user is logged in
    let profileStatus = null;
    if (user) {
      const adminDb = getAdminDb();
      if (adminDb) {
        const userDoc = await adminDb.collection("users").doc(user.uid).get();
        const userProfile = userDoc.exists ? userDoc.data() : null;
        const displayName = userProfile?.displayName || user.name;
        
        profileStatus = {
          hasDisplayName: Boolean(displayName && displayName.trim().length > 0),
          isPublic: Boolean(userProfile?.visibility?.isPublic),
          displayName: displayName || null,
        };
      }
    }

    const canClaim = user && profileStatus?.hasDisplayName && profileStatus?.isPublic;
    
    let message = "Please log in to claim this agent.";
    if (user && !profileStatus?.hasDisplayName) {
      message = "Please add a display name to your profile to claim this agent.";
    } else if (user && !profileStatus?.isPublic) {
      message = "Please set your profile to public to claim this agent.";
    } else if (user && canClaim) {
      message = `You are logged in as ${user.email}. Click confirm to claim this agent.`;
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        status: agent.status,
        createdAt: agent.createdAt,
        claimExpiresAt: agent.claimExpiresAt,
      },
      user: user
        ? {
            uid: user.uid,
            email: user.email,
            displayName: profileStatus?.displayName || user.name,
          }
        : null,
      profileStatus,
      canClaim,
      message,
    });
  } catch (error) {
    logApiError("/api/agents/claim/[token] GET", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get claim information",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/claim/[token]
 * Claim an agent (link to authenticated user).
 * Requires the user to be logged in.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Apply rate limiting (stricter for POST to prevent claim abuse)
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateLimitResult = checkRateLimit(`agent-claim-post:${clientId}`, CLAIM_RATE_LIMIT);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests",
          retryAfterSeconds: rateLimitResult.retryAfter,
        },
        { 
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfter || 60),
          },
        }
      );
    }

    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Claim token is required",
        },
        { status: 400 }
      );
    }

    // Verify user is logged in
    let user;
    try {
      user = await getVerifiedUser(request);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          hint: "Please log in to claim this agent",
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          hint: "Please log in to claim this agent",
        },
        { status: 401 }
      );
    }

    // Check profile requirements
    const adminDb = getAdminDb();
    if (!adminDb) {
      throw new Error("Firebase Admin is not configured");
    }

    const userDoc = await adminDb.collection("users").doc(user.uid).get();
    const userProfile = userDoc.exists ? userDoc.data() : null;

    // Check if profile has a display name
    const displayName = userProfile?.displayName || user.name;
    if (!displayName || displayName.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Profile incomplete",
          code: "PROFILE_INCOMPLETE",
          hint: "Please add a display name to your profile before claiming an agent.",
          action: {
            type: "complete_profile",
            url: "/profile",
          },
        },
        { status: 400 }
      );
    }

    // Check if profile is public
    if (!userProfile?.visibility?.isPublic) {
      return NextResponse.json(
        {
          success: false,
          error: "Profile must be public",
          code: "PROFILE_NOT_PUBLIC",
          hint: "Please set your profile to public before claiming an agent. This helps build trust in the community.",
          action: {
            type: "make_public",
            url: "/profile",
          },
        },
        { status: 400 }
      );
    }

    // Claim the agent
    const claimedAgent = await claimAgent(
      token,
      user.uid,
      user.email,
      user.name
    );

    if (!claimedAgent) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired claim token",
          hint: "The agent may have already been claimed, or the claim link has expired (7 days).",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Agent claimed successfully!",
      agent: {
        id: claimedAgent.id,
        name: claimedAgent.name,
        description: claimedAgent.description,
        status: claimedAgent.status,
        owner: {
          uid: user.uid,
          email: user.email,
          displayName: user.name,
        },
        claimedAt: claimedAgent.claimedAt,
      },
      nextSteps: [
        "Your agent is now linked to your account.",
        "The agent can now authenticate using its API key.",
        "You can view your agents in your profile settings.",
      ],
    });
  } catch (error) {
    logApiError("/api/agents/claim/[token] POST", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to claim agent",
      },
      { status: 500 }
    );
  }
}
