import { NextRequest, NextResponse } from "next/server";
import {
  getVerifiedAgent,
  updateAgentProfile,
  toPublicProfile,
} from "@/lib/agents";

/**
 * GET /api/agents/me
 * Get the authenticated agent's profile.
 */
export async function GET(request: NextRequest) {
  try {
    const agent = await getVerifiedAgent(request);

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          hint: "Include your API key in the Authorization header: Bearer cb_agent_xxx",
        },
        { status: 401 }
      );
    }

    // Return full profile for the agent itself (not just public profile)
    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        status: agent.status,
        avatarUrl: agent.avatarUrl,
        visibility: agent.visibility,
        createdAt: agent.createdAt,
        lastActiveAt: agent.lastActiveAt,
        ...(agent.status === "claimed" && {
          owner: {
            id: agent.ownerId,
            email: agent.ownerEmail,
            displayName: agent.ownerDisplayName,
          },
          claimedAt: agent.claimedAt,
        }),
        ...(agent.status === "pending_claim" && {
          claimExpiresAt: agent.claimExpiresAt,
        }),
      },
    });
  } catch (error) {
    console.error("Error getting agent profile:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get profile",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/me
 * Update the authenticated agent's profile.
 */
export async function PATCH(request: NextRequest) {
  try {
    const agent = await getVerifiedAgent(request);

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          hint: "Include your API key in the Authorization header: Bearer cb_agent_xxx",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, avatarUrl, visibility } = body;

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};

    // Validate and add name
    if (name !== undefined) {
      if (typeof name !== "string") {
        return NextResponse.json(
          { success: false, error: "Name must be a string" },
          { status: 400 }
        );
      }
      const trimmedName = name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 50) {
        return NextResponse.json(
          { success: false, error: "Name must be between 2 and 50 characters" },
          { status: 400 }
        );
      }
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
        return NextResponse.json(
          {
            success: false,
            error: "Name can only contain letters, numbers, spaces, hyphens, and underscores",
          },
          { status: 400 }
        );
      }
      updates.name = trimmedName;
    }

    // Validate and add description
    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return NextResponse.json(
          { success: false, error: "Description must be a string or null" },
          { status: 400 }
        );
      }
      const trimmedDescription = description?.trim() || null;
      if (trimmedDescription && trimmedDescription.length > 500) {
        return NextResponse.json(
          { success: false, error: "Description must be 500 characters or less" },
          { status: 400 }
        );
      }
      updates.description = trimmedDescription;
    }

    // Validate and add avatarUrl
    if (avatarUrl !== undefined) {
      if (avatarUrl !== null && typeof avatarUrl !== "string") {
        return NextResponse.json(
          { success: false, error: "Avatar URL must be a string or null" },
          { status: 400 }
        );
      }
      if (avatarUrl) {
        try {
          new URL(avatarUrl);
        } catch {
          return NextResponse.json(
            { success: false, error: "Avatar URL must be a valid URL" },
            { status: 400 }
          );
        }
      }
      updates.avatarUrl = avatarUrl || null;
    }

    // Validate and add visibility
    if (visibility !== undefined) {
      if (typeof visibility !== "object" || visibility === null) {
        return NextResponse.json(
          { success: false, error: "Visibility must be an object" },
          { status: 400 }
        );
      }
      const newVisibility = { ...agent.visibility };
      if (typeof visibility.isPublic === "boolean") {
        newVisibility.isPublic = visibility.isPublic;
      }
      if (typeof visibility.showOwner === "boolean") {
        newVisibility.showOwner = visibility.showOwner;
      }
      updates.visibility = newVisibility;
    }

    // Check if there's anything to update
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No valid fields to update",
          hint: "Provide one or more of: name, description, avatarUrl, visibility",
        },
        { status: 400 }
      );
    }

    // Perform update
    await updateAgentProfile(agent.id, updates);

    // Return updated profile
    const updatedAgent = { ...agent, ...updates };
    return NextResponse.json({
      success: true,
      agent: toPublicProfile(updatedAgent),
    });
  } catch (error) {
    console.error("Error updating agent profile:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update profile",
      },
      { status: 500 }
    );
  }
}
