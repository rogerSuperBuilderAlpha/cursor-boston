/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { logger } from "@/lib/logger";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  LUDWITT_AI_MESSAGES_URL,
  LUDWITT_TOPUP_URL,
  fetchLudwittWithTimeout,
} from "@/lib/ludwitt-config";
import {
  deleteLudwittTokens,
  withFreshLudwittAccessToken,
} from "@/lib/ludwitt-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | unknown;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
}

function validateBody(input: unknown): AnthropicRequest | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  if (typeof r.model !== "string" || !r.model) return null;
  if (typeof r.max_tokens !== "number" || r.max_tokens <= 0) return null;
  if (!Array.isArray(r.messages) || r.messages.length === 0) return null;
  for (const m of r.messages) {
    if (!m || typeof m !== "object") return null;
    const role = (m as { role?: unknown }).role;
    if (role !== "user" && role !== "assistant") return null;
  }
  return r as unknown as AnthropicRequest;
}

async function handleAiMessages(request: NextRequest): Promise<NextResponse> {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const validated = validateBody(body);
  if (!validated) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  let result: { status: number; body: unknown; headers: Headers };
  try {
    result = await withFreshLudwittAccessToken(user.uid, async (accessToken) => {
      const upstream = await fetchLudwittWithTimeout(LUDWITT_AI_MESSAGES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validated),
      });
      const json = await upstream.json().catch(() => null);
      return { status: upstream.status, body: json, headers: upstream.headers };
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "ludwitt_not_connected") {
      return NextResponse.json(
        { error: "ludwitt_not_connected", connectUrl: "/api/ludwitt/authorize" },
        { status: 412 }
      );
    }
    logger.logError(err, { stage: "ludwitt_ai_messages", uid: user.uid });
    return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
  }

  // 401 after refresh-retry → session genuinely dead, force re-sign-in
  if (result.status === 401) {
    await deleteLudwittTokens(user.uid).catch(() => {});
    return NextResponse.json(
      { error: "ludwitt_session_expired" },
      { status: 401 }
    );
  }

  if (result.status === 402) {
    return NextResponse.json(
      { error: "out_of_credits", topUpUrl: LUDWITT_TOPUP_URL },
      { status: 402 }
    );
  }

  if (result.status >= 400) {
    return NextResponse.json(
      {
        error: "upstream_error",
        upstreamStatus: result.status,
        upstreamBody: result.body,
      },
      { status: result.status >= 500 ? 502 : result.status }
    );
  }

  // Success — forward body and credit metadata header
  const credits = result.headers.get("x-ludwitt-credits");
  const headers: Record<string, string> = {};
  if (credits) headers["x-ludwitt-credits"] = credits;
  return NextResponse.json(result.body, { status: 200, headers });
}

export const POST = withMiddleware(rateLimitConfigs.standard, handleAiMessages);
