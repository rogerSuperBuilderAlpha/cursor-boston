/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { getAdminDb } from "./firebase-admin";
import { GlossaryTerm } from "@/types/glossary";

const COLLECTION_NAME = "glossaryTerms";

/**
 * Fetch all approved glossary terms, sorted alphabetically.
 */
export async function getApprovedTerms(): Promise<GlossaryTerm[]> {
  const db = getAdminDb();
  if (!db) return [];

  const snapshot = await db
    .collection(COLLECTION_NAME)
    .where("status", "==", "approved")
    .orderBy("term", "asc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<GlossaryTerm, "id">),
  }));
}

/**
 * Fetch a single glossary term by its slug.
 */
export async function getTermBySlug(slug: string): Promise<GlossaryTerm | null> {
  const db = getAdminDb();
  if (!db) return null;

  const snapshot = await db
    .collection(COLLECTION_NAME)
    .where("slug", "==", slug)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...(doc.data() as Omit<GlossaryTerm, "id">),
  };
}

/**
 * Generate a URL-friendly slug from a term.
 */
export function generateSlug(term: string): string {
  return term
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
