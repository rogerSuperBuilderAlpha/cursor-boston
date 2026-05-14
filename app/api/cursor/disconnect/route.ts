/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cursorContract } from "@/lib/api-schemas/cursor";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: cursorContract.disconnect (lib/api-schemas/cursor.ts)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

void cursorContract;

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
    await Promise.all([
      db
        .collection("users")
        .doc(user.uid)
        .set({ cursor: FieldValue.delete() }, { merge: true }),
      db
        .collection("users")
        .doc(user.uid)
        .collection("secrets")
        .doc("cursor")
        .delete(),
    ]);

    return NextResponse.json({ disconnected: true });
  } catch (err) {
    logger.logError(err, { stage: "cursor_disconnect", uid: user.uid });
    return NextResponse.json({ error: "disconnect_failed" }, { status: 500 });
  }
}

export const POST = withMiddleware(
  rateLimitConfigs.oauthCallback,
  handleDisconnect
);
