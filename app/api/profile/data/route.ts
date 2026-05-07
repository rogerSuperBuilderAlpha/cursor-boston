/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { fetchProfileDataBundleJson } from "@/lib/profile-bundle-server";
import { reconcileMergedPrCreditForUser } from "@/lib/github-merged-pr-reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 60 };

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`profile-data:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const triggerReconcile = request.nextUrl.searchParams.get("reconcileGithub") === "1";
    if (triggerReconcile) {
      const userSnap = await db.collection("users").doc(user.uid).get();
      if (userSnap.exists) {
        const github =
          userSnap.data()?.github && typeof userSnap.data()?.github === "object"
            ? (userSnap.data()?.github as { login?: string })
            : null;
        const githubLogin =
          typeof github?.login === "string" && github.login.trim() ? github.login.trim() : null;
        if (githubLogin) {
          await reconcileMergedPrCreditForUser(user.uid, githubLogin);
        }
      }
    }

    const payload = await fetchProfileDataBundleJson(db, user.uid);

    // GDPR Article 20 portable-format mode. Triggered when the client
    // adds `?format=portable` (used by the "Download my data" button on
    // the profile Security tab). Wraps the bundle in a documented schema
    // with version + exported-at metadata so downstream consumers
    // (the user, a future archival tool) can parse it deterministically.
    //
    // The unwrapped legacy shape is preserved when the param is absent
    // because existing callers expect the bundle directly.
    const format = request.nextUrl.searchParams.get("format");
    if (format === "portable") {
      const portable = {
        schema: "cursor-boston-data-export-v1",
        schemaUrl:
          "https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/develop/docs/OPENSOURCE_REVIEW.md#dim-4--privacy-data-handling--trust--safety",
        version: "1.0",
        exportedAt: new Date().toISOString(),
        userId: user.uid,
        notes:
          "Per GDPR Article 20 (right to data portability). Includes profile, contributions, and event participation. Anonymized records are not included; deleted-user content is omitted.",
        data: payload,
      };
      return NextResponse.json(portable, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": `attachment; filename="cursor-boston-data-${user.uid}.json"`,
        },
      });
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[api/profile/data]", e);
    return NextResponse.json({ error: "Failed to load profile data" }, { status: 500 });
  }
}
