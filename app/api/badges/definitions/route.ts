import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";
import { logger } from "@/lib/logger";
import type { BadgeDefinition, BadgeId } from "@/lib/badges/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const EXPECTED_BADGE_IDS = new Set<BadgeId>(BADGE_DEFINITIONS.map((definition) => definition.id));

function isBadgeDefinition(value: unknown): value is BadgeDefinition {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<BadgeDefinition>;
  return (
    typeof v.id === "string" &&
    EXPECTED_BADGE_IDS.has(v.id as BadgeId) &&
    typeof v.name === "string" &&
    typeof v.description === "string" &&
    typeof v.category === "string" &&
    typeof v.howToEarn === "string" &&
    typeof v.sortOrder === "number"
  );
}

export async function GET() {
  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({
        definitions: BADGE_DEFINITIONS,
        source: "local-fallback",
      });
    }

    const collectionRef = db.collection("badges");
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
      const batch = db.batch();
      for (const definition of BADGE_DEFINITIONS) {
        batch.set(collectionRef.doc(definition.id), definition);
      }
      await batch.commit();
      return NextResponse.json({
        definitions: BADGE_DEFINITIONS,
        source: "seeded-fallback",
      });
    }

    const definitions = snapshot.docs
      .map((doc) => doc.data())
      .filter(isBadgeDefinition)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const definitionIds = new Set(definitions.map((definition) => definition.id));
    const missingBadgeIds = BADGE_DEFINITIONS
      .map((definition) => definition.id)
      .filter((badgeId) => !definitionIds.has(badgeId));

    if (definitions.length === 0 || missingBadgeIds.length > 0) {
      if (missingBadgeIds.length > 0) {
        logger.warn("Firestore badge definitions incomplete. Falling back to local definitions.", {
          endpoint: "/api/badges/definitions",
          firestoreCount: definitions.length,
          expectedCount: BADGE_DEFINITIONS.length,
          missingBadgeIds,
        });
      }

      return NextResponse.json({
        definitions: BADGE_DEFINITIONS,
        source: "local-fallback",
      });
    }

    return NextResponse.json({ definitions, source: "firestore" });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/badges/definitions",
      method: "GET",
    });
    return NextResponse.json({
      definitions: BADGE_DEFINITIONS,
      source: "local-fallback",
    });
  }
}
