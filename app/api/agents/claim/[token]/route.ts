import { NextRequest, NextResponse } from "next/server";
import { getAgentByClaimToken, claimAgent } from "@/lib/agents";
import { getVerifiedUser } from "@/lib/server-auth";

interface RouteContext {
  params: Promise<{ token: string }>;
}

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
            displayName: user.name,
          }
        : null,
      canClaim: !!user,
      message: user
        ? `You are logged in as ${user.email}. Click confirm to claim this agent.`
        : "Please log in to claim this agent.",
    });
  } catch (error) {
    console.error("Error getting agent claim info:", error);
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
    console.error("Error claiming agent:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to claim agent",
      },
      { status: 500 }
    );
  }
}
