/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/hackathons/showcase/hack-a-sprint-2026/vote
 * Legacy “pick 6” peer vote removed. Use participant-score instead.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This voting API is retired. Use peer1–10 scores via POST …/participant-score.",
    },
    { status: 410 }
  );
}
