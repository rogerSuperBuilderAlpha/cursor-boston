/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";
import { getKonamiToken } from "@/lib/treasure-hunt-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the rotating daily Konami token. Only reveals it when the client
 * presents proof they know the sequence (X-Konami-Sequence header). This
 * stops a casual GET /api/hunt/oracle/konami from leaking the answer.
 */
export async function GET(request: Request) {
  const sequence = request.headers.get("x-konami-sequence") || "";
  if (sequence !== "UUDDLRLRBA") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ token: getKonamiToken() });
}
