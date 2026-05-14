/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cursorContract } from "@/lib/api-schemas/cursor";
import { encryptApiKey, fingerprintApiKey } from "@/lib/cursor/encryption";
import {
  InvalidCursorKeyError,
  validateCursorApiKey,
} from "@/lib/cursor/validate";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { getVerifiedUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMonthlyCapUsd(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (![0, 5, 25, 100].includes(value)) return null;
  return value;
}

async function handleConnect(request: NextRequest): Promise<NextResponse> {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsedBody = cursorContract.connect.body.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const apiKey = parsedBody.data.apiKey.trim();
  const monthlyCapUsd = parseMonthlyCapUsd(parsedBody.data.monthlyCapUsd);

  if (!apiKey || monthlyCapUsd === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const accountInfo = await validateCursorApiKey(apiKey);
    const encrypted = encryptApiKey(apiKey);
    const fingerprint = fingerprintApiKey(apiKey);
    const now = FieldValue.serverTimestamp();

    await Promise.all([
      db
        .collection("users")
        .doc(user.uid)
        .set(
          {
            cursor: {
              apiKeyFingerprint: fingerprint,
              modelsAvailable: accountInfo.modelsAvailable,
              defaultModel: accountInfo.defaultModel,
              monthlyCapUsd,
              scopesConsented: [],
              connectedAt: now,
              lastUsedAt: null,
              revokedAt: null,
            },
          },
          { merge: true }
        ),
      db
        .collection("users")
        .doc(user.uid)
        .collection("secrets")
        .doc("cursor")
        .set({
          apiKeyEncrypted: encrypted,
          rotatedAt: now,
        }),
    ]);

    return NextResponse.json({
      ok: true,
      fingerprint,
      defaultModel: accountInfo.defaultModel,
    });
  } catch (err) {
    if (err instanceof InvalidCursorKeyError) {
      return NextResponse.json({ error: "invalid_key" }, { status: 400 });
    }

    logger.logError(err, { stage: "cursor_connect", uid: user.uid });
    return NextResponse.json({ error: "connect_failed" }, { status: 500 });
  }
}

export const POST = withMiddleware(rateLimitConfigs.oauthCallback, handleConnect);
