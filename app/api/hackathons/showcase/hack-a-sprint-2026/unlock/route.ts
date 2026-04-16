/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/hackathons/showcase/hack-a-sprint-2026/unlock
 * Passcode unlock has been removed. Check-in at the door is now the gate.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Passcode unlock has been removed. Ask an organizer to check you in." },
    { status: 410 }
  );
}
