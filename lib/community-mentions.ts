/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

const MENTION_PATTERN = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{2,30})(?![A-Za-z0-9_-])/g;
const MAX_MENTIONS_PER_POST = 25;

/**
 * Extract normalized mention handles from community post content.
 *
 * Handles are stored without the leading `@`, lowercased, deduplicated, and
 * restricted to ASCII letters, numbers, and underscores so the resulting
 * Firestore array is safe to query with `array-contains`.
 */
export function extractCommunityMentions(content: string): string[] {
  if (typeof content !== "string" || content.length === 0) return [];

  const mentions: string[] = [];
  const seen = new Set<string>();

  for (const match of content.matchAll(MENTION_PATTERN)) {
    const handle = match[2]?.toLowerCase();
    if (!handle || seen.has(handle)) continue;

    seen.add(handle);
    mentions.push(handle);

    if (mentions.length >= MAX_MENTIONS_PER_POST) break;
  }

  return mentions;
}
