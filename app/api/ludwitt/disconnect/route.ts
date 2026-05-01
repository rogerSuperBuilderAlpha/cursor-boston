/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { logger } from "@/lib/logger";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { deleteLudwittTokens } from "@/lib/ludwitt-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleDisconnect(request: NextRequest): Promise<NextResponse> {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  try {
    await deleteLudwittTokens(user.uid);
    await db
      .collection("users")
      .doc(user.uid)
      .set({ ludwitt: FieldValue.delete() }, { merge: true });
    return NextResponse.json({ disconnected: true });
  } catch (err) {
    logger.logError(err, { stage: "ludwitt_disconnect", uid: user.uid });
    return NextResponse.json({ error: "disconnect_failed" }, { status: 500 });
  }
}

export const POST = withMiddleware(rateLimitConfigs.standard, handleDisconnect);
