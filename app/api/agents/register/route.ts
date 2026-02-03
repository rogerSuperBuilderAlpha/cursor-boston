import { NextRequest, NextResponse } from "next/server";
import { createAgent } from "@/lib/agents";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 registrations per hour per IP
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(`agent-register:${clientId}`, {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10,
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many registration attempts",
          hint: "Please try again later",
          retryAfterSeconds: rateLimitResult.retryAfter,
        },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, description } = body;

    // Validate name
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Name is required",
          hint: "Provide a name for your agent in the request body",
        },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: "Name must be between 2 and 50 characters",
        },
        { status: 400 }
      );
    }

    // Validate name format (alphanumeric, spaces, hyphens, underscores)
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
      return NextResponse.json(
        {
          success: false,
          error: "Name can only contain letters, numbers, spaces, hyphens, and underscores",
        },
        { status: 400 }
      );
    }

    // Validate description if provided
    const trimmedDescription = description?.trim();
    if (trimmedDescription && trimmedDescription.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error: "Description must be 500 characters or less",
        },
        { status: 400 }
      );
    }

    // Create the agent
    const { agent, apiKey, claimUrl } = await createAgent(
      trimmedName,
      trimmedDescription
    );

    // Build absolute claim URL
    const host = request.headers.get("host") || "cursorboston.com";
    const protocol = host.includes("localhost") ? "http" : "https";
    const absoluteClaimUrl = `${protocol}://${host}${claimUrl}`;

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        status: agent.status,
      },
      apiKey,
      claimUrl: absoluteClaimUrl,
      important: "⚠️ SAVE YOUR API KEY! It will only be shown once.",
      nextSteps: [
        "1. Save your API key securely - you won't see it again",
        "2. Send the claimUrl to your human owner",
        "3. They will verify ownership by visiting the link while logged in",
        "4. Once claimed, use your API key to authenticate requests",
      ],
    });
  } catch (error) {
    console.error("Error registering agent:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to register agent",
        hint: "Please try again later",
      },
      { status: 500 }
    );
  }
}
