/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Returns true if any search term matches the entry's title, description, or tags (case-insensitive).
 *
 * @param title - Entry title.
 * @param description - Body text.
 * @param tags - Tag strings.
 * @param terms - Already normalized search tokens (e.g. lowercased); empty means match all.
 * @returns `true` if there is a hit or `terms` is empty.
 */
export function matchesCookbookSearchTerms(
  title: string,
  description: string,
  tags: string[],
  terms: string[]
): boolean {
  if (terms.length === 0) return true;
  const titleL = title.toLowerCase();
  const descL = description.toLowerCase();
  const tagStr = tags.join(" ").toLowerCase();
  return terms.some(
    (term) =>
      titleL.includes(term) ||
      descL.includes(term) ||
      tagStr.includes(term)
  );
}
