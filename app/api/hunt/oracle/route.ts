/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getOracleAnswer } from "@/lib/treasure-hunt-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Riddle: "I am what sha256 will become when fed today's salt and the UTC
 * calendar date in YYYY-MM-DD. Submit my 64 hex characters."
 *
 * The client can compute this locally if they reverse-engineer the riddle,
 * or they can just lift the value off this endpoint — both are valid moves.
 * We still require them to submit it, so a passive reader doesn't win.
 */
export async function GET() {
  const answerHash = createHash("sha256")
    .update(getOracleAnswer())
    .digest("hex")
    .slice(0, 16);
  return NextResponse.json({
    riddle:
      "I am the sha256 of today's UTC YYYY-MM-DD, salted with a phrase " +
      "only this server knows. Submit my 64 hex characters at " +
      "/api/hunt/paths/oracle/submit.",
    dateUtc: new Date().toISOString().slice(0, 10),
    answerFingerprint: answerHash,
  });
}
