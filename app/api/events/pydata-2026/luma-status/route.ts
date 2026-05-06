/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { PYDATA_2026_LUMA_EVENT_NAME } from "@/lib/pydata-2026";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ signedIn: false, onLumaList: false });
  }
  const email = (user.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ signedIn: true, onLumaList: false });
  }
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  const snap = await db.collection("eventContacts").doc(email).get();
  if (!snap.exists) {
    return NextResponse.json({ signedIn: true, onLumaList: false });
  }
  const data = snap.data() || {};
  const eventNames: unknown = data.eventNames;
  const onLumaList =
    Array.isArray(eventNames) &&
    eventNames.some(
      (n) => typeof n === "string" && n === PYDATA_2026_LUMA_EVENT_NAME
    );
  return NextResponse.json({ signedIn: true, onLumaList });
}

export const GET = withMiddleware(rateLimitConfigs.standard, handleGet);
