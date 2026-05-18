/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  buildLinkedInAddToProfileUrl,
  listCertificatesForUser,
} from "@/lib/certificate";
import { logger } from "@/lib/logger";

// @contracts: certificateContract.mine (lib/api-schemas/certificate.ts)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const certificates = await listCertificatesForUser(db, user.uid);

    return NextResponse.json({
      certificates: certificates.map((certificate) => ({
        certificate,
        linkedInAddToProfileUrl: buildLinkedInAddToProfileUrl(certificate),
      })),
    });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/certificate/mine",
      method: "GET",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
