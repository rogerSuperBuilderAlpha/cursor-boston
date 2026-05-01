/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { LUDWITT_FINALIZE_COOKIE } from "@/lib/ludwitt-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleFinalize(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(LUDWITT_FINALIZE_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  const response = NextResponse.json({ token });
  response.cookies.set(LUDWITT_FINALIZE_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}

export const POST = withMiddleware(rateLimitConfigs.standard, handleFinalize);
