/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { generateSlug } from "@/lib/glossary";
import { sanitizeText } from "@/lib/sanitize";
import { apiSuccess, apiError } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION_NAME = "glossaryTerms";

/**
 * GET /api/glossary/term
 * Fetches approved glossary terms.
 */
export async function GET(_request: NextRequest) {
  try {
    const db = getAdminDb();
    if (!db) return apiError("Firestore not configured", 500);

    const snapshot = await db
      .collection(COLLECTION_NAME)
      .where("status", "==", "approved")
      .orderBy("term", "asc")
      .get();

    const terms = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return apiSuccess({ terms });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/glossary/term GET" });
    return apiError("Internal server error", 500);
  }
}

/**
 * POST /api/glossary/term
 * Submits a new term or an edit for approval.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Unauthorized", 401);

    const db = getAdminDb();
    if (!db) return apiError("Firestore not configured", 500);

    const body = await request.json();
    const { term, definition, category } = body;

    if (!term || !definition) {
      return apiError("Term and definition are required", 400);
    }

    const sanitizedTerm = sanitizeText(term).trim();
    const sanitizedDefinition = sanitizeText(definition).trim();
    const sanitizedCategory = category ? sanitizeText(category).trim() : "General";
    
    const slug = generateSlug(sanitizedTerm);
    if (!slug) return apiError("Invalid term name", 400);

    const docRef = db.collection(COLLECTION_NAME).doc(slug);
    const docSnap = await docRef.get();

    const now = FieldValue.serverTimestamp();
    const status = user.isAdmin ? "approved" : "pending";

    if (docSnap.exists) {
      // Update existing term (Suggest edit)
      const editEntry = {
        userId: user.uid,
        userName: user.name || "Anonymous",
        timestamp: new Date().toISOString(),
        changes: "Updated definition/category",
      };

      await docRef.update({
        definition: sanitizedDefinition,
        category: sanitizedCategory,
        status, // Re-verify if not admin?
        updatedAt: now,
        editHistory: FieldValue.arrayUnion(editEntry),
      });

      return apiSuccess({ message: "Edit submitted for approval", slug, status });
    } else {
      // Create new term
      const newTerm = {
        term: sanitizedTerm,
        slug,
        definition: sanitizedDefinition,
        category: sanitizedCategory,
        status,
        createdBy: {
          uid: user.uid,
          name: user.name || "Anonymous",
        },
        createdAt: now,
        updatedAt: now,
        editHistory: [],
      };

      await docRef.set(newTerm);
      return apiSuccess({ message: "Term submitted for approval", slug, status });
    }
  } catch (error) {
    logger.logError(error, { endpoint: "/api/glossary/term POST" });
    return apiError("Internal server error", 500);
  }
}
