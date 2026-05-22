/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAgent, getVerifiedAgent } from "@/lib/agents";
import { getClientIdentifier } from "@/lib/rate-limit";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import type { UpstashRateLimitResult } from "@/lib/upstash-rate-limit";
import { parseRequestBody } from "@/lib/api-response";
import { agentsContract } from "@/lib/api-schemas/agents";

const FAIL_CLOSED_RATE_LIMIT = { failMode: "closed" } as const;

function rateLimitResponse(rate: UpstashRateLimitResult): NextResponse {
  const retryAfter = rate.retryAfter || 60;
  const unavailable = rate.reason === "rate_limit_unavailable";

  return NextResponse.json(
    {
      success: false,
      error: unavailable
        ? "Rate limit unavailable"
        : "Too many registration attempts",
      hint: "Please try again later",
      retryAfterSeconds: retryAfter,
    },
    {
      status: unavailable ? 503 : 429,
      headers: { "Retry-After": String(retryAfter) },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    // Check if agent is already registered (has valid API key)
    const existingAgent = await getVerifiedAgent(request);
    if (existingAgent) {
      return NextResponse.json(
        {
          success: false,
          error: "Agent already registered",
          hint: "You already have a valid API key. Use GET /api/agents/me to view your profile.",
          agent: {
            id: existingAgent.id,
            name: existingAgent.name,
            status: existingAgent.status,
          },
        },
        { status: 409 }
      );
    }

    // Rate limit: 10 registrations per hour per IP
    const clientId = getClientIdentifier(request);
    const rateLimitResult = await checkUpstashRateLimit(
      `agent-register:${clientId}`,
      {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 10,
      },
      FAIL_CLOSED_RATE_LIMIT
    );

    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    // Parse request body
    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = agentsContract.register.body.safeParse(bodyOrError);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Invalid body",
        },
        { status: 400 }
      );
    }
    const trimmedName = parsed.data.name.trim();
    const trimmedDescription = parsed.data.description?.trim();

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
