/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { gameContract } from "@/lib/api-schemas/game";
import { getAdminDb } from "@/lib/firebase-admin";
import { mapGameError } from "@/lib/game/api-error-map";
import { HEROES_COLLECTION } from "@/lib/game/hero-registry";
import { getHeroBackstoryServer } from "@/lib/game/heroes-server";
import { getVerifiedUser } from "@/lib/server-auth";

// GET /api/game/heroes/[heroId]/backstory
//
// Returns markdown content from
// `lib/game/content/hero-backstories/<heroId>.md`, or `markdown: null` if
// no chapter has been contributed yet. Backstories are fully public —
// no visibility filter beyond authentication.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ heroId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const { heroId } = await context.params;
    const parsed = gameContract.getHeroBackstory.pathParams.safeParse({
      heroId,
    });
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid heroId", 400);
    }

    // Confirm the hero exists so a missing backstory is distinguishable
    // from a missing hero (404 vs. 200 + null markdown).
    const db = getAdminDb();
    if (!db) return apiError("Firestore not configured", 500);
    const heroSnap = await db
      .collection(HEROES_COLLECTION)
      .doc(parsed.data.heroId)
      .get();
    if (!heroSnap.exists) return apiError("Hero not found", 404);

    const markdown = await getHeroBackstoryServer({
      heroId: parsed.data.heroId,
    });

    return apiSuccess({
      heroId: parsed.data.heroId,
      markdown,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
