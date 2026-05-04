/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  PYDATA_2026_CAPACITY,
  PYDATA_2026_REGISTRATIONS_COLLECTION,
} from "@/lib/pydata-2026";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated endpoint: just the cap-vs-registered numbers so the
 * /register page can show "X / 150 spots claimed". Doesn't expose names.
 */
export async function GET() {
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  // Could be cached but the volume is low; query each time keeps it fresh.
  const snap = await db
    .collection(PYDATA_2026_REGISTRATIONS_COLLECTION)
    .where("status", "in", ["awaiting-badge", "badge-ready", "checked-in"])
    .count()
    .get();
  const claimed = snap.data().count;
  const remaining = Math.max(0, PYDATA_2026_CAPACITY - claimed);
  const full = claimed >= PYDATA_2026_CAPACITY;
  return NextResponse.json({
    capacity: PYDATA_2026_CAPACITY,
    claimed,
    remaining,
    full,
  });
}
