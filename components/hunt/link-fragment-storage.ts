/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { LinkFragmentPuzzleId } from "@/lib/link-fragment-hunt";

export const LINK_FRAGMENT_STORAGE_KEY = "cb-link-fragment-hunt-v1";
export const LINK_FRAGMENT_UPDATED_EVENT = "cb-link-fragments-updated";

export type StoredLinkFragment = {
  puzzleId: LinkFragmentPuzzleId;
  fragment: string;
  token: string;
  index: number;
};

export function readStoredFragments(): StoredLinkFragment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LINK_FRAGMENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredLinkFragment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeStoredFragment(entry: StoredLinkFragment): void {
  if (typeof window === "undefined") return;
  const existing = readStoredFragments().filter((f) => f.puzzleId !== entry.puzzleId);
  existing.push(entry);
  existing.sort((a, b) => a.index - b.index);
  window.localStorage.setItem(LINK_FRAGMENT_STORAGE_KEY, JSON.stringify(existing));
  window.dispatchEvent(new CustomEvent(LINK_FRAGMENT_UPDATED_EVENT));
}

export function storedFragmentMap(): Partial<
  Record<LinkFragmentPuzzleId, StoredLinkFragment>
> {
  const map: Partial<Record<LinkFragmentPuzzleId, StoredLinkFragment>> = {};
  for (const f of readStoredFragments()) {
    map[f.puzzleId] = f;
  }
  return map;
}
