/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { DocumentSnapshot, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { sanitizeDocId } from "@/lib/sanitize";
import {
  COOKBOOK_CATEGORIES,
  WORKS_WITH_LANGUAGES,
  type CookbookCategory,
  type CookbookEntry,
  type CookbookEntrySeo,
  type WorksWithTag,
} from "@/types/cookbook";

type CookbookDoc = DocumentSnapshot | QueryDocumentSnapshot;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function isValidCookbookCategory(value: string): value is CookbookCategory {
  return COOKBOOK_CATEGORIES.includes(value as CookbookCategory);
}

export function isValidWorksWithTag(value: string): value is WorksWithTag {
  return WORKS_WITH_LANGUAGES.includes(value as WorksWithTag);
}

function timestampToIso(value: unknown): string {
  if (!isRecord(value) || typeof value.toMillis !== "function") return "";
  return new Date(value.toMillis()).toISOString();
}

function normalizeSeo(data: Record<string, unknown>): CookbookEntrySeo | undefined {
  const seoSource = isRecord(data.seo) ? data.seo : {};
  const seo: CookbookEntrySeo = {
    title: readString(seoSource.title) ?? readString(data.seoTitle),
    description:
      readString(seoSource.description) ?? readString(data.seoDescription),
    image:
      readString(seoSource.image) ??
      readString(seoSource.ogImage) ??
      readString(data.ogImageUrl),
    canonicalUrl:
      readString(seoSource.canonicalUrl) ?? readString(data.canonicalUrl),
  };

  return Object.values(seo).some(Boolean) ? seo : undefined;
}

export function mapCookbookDocToEntry(doc: CookbookDoc): CookbookEntry {
  const rawData = doc.data();
  const data = isRecord(rawData) ? rawData : {};
  const category = readString(data.category) ?? "other";
  const upCount = Number(data.upCount ?? 0);
  const downCount = Number(data.downCount ?? 0);

  return {
    id: doc.id,
    title: readString(data.title) ?? "",
    description: readString(data.description) ?? "",
    promptContent: readString(data.promptContent) ?? "",
    category: isValidCookbookCategory(category) ? category : "other",
    tags: readStringArray(data.tags),
    worksWith: readStringArray(data.worksWith).filter(isValidWorksWithTag),
    authorId: readString(data.authorId) ?? "",
    authorDisplayName: readString(data.authorDisplayName) ?? "",
    createdAt: timestampToIso(data.createdAt),
    upCount,
    downCount,
    seo: normalizeSeo(data),
  };
}

export async function getCookbookEntryById(id: string): Promise<CookbookEntry | null> {
  const sanitizedId = sanitizeDocId(id);
  if (!sanitizedId) return null;

  const db = getAdminDb();
  if (!db) return null;

  const doc = await db.collection("cookbook_entries").doc(sanitizedId).get();
  if (!doc.exists) return null;

  return mapCookbookDocToEntry(doc);
}
