/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Display helpers for game catalog entries (spells, units, upgrades, castes,
 * buildings). Each catalog entry may carry optional `lore` and `imageUrl`
 * fields. These helpers normalize the access so render surfaces don't each
 * re-implement the fallback rules.
 *
 * Pure / dependency-free — safe to import from both server and client code.
 */

/** Logo used when a catalog entry has no `imageUrl` yet. */
export const FALLBACK_LOGO_SRC = "/logo.svg";

/** Placeholder copy used when a catalog entry has no `lore` yet. */
export const LORE_PLACEHOLDER = "No lore yet.";

interface ImageBearing {
  imageUrl?: string | null;
}

interface LoreBearing {
  lore?: string | null;
}

/** Resolve the src to render for a catalog entry — real `imageUrl` if set,
 *  otherwise the project logo. */
export function getCatalogImageSrc(entry: ImageBearing | null | undefined): string {
  const url = entry?.imageUrl?.trim();
  return url ? url : FALLBACK_LOGO_SRC;
}

/** True when the entry carries real art (used to dim the fallback state). */
export function hasCatalogImage(entry: ImageBearing | null | undefined): boolean {
  return Boolean(entry?.imageUrl?.trim());
}

/** Resolve the lore text to render — the entry's `lore` if set, otherwise
 *  the placeholder string. Always returns a non-empty string. */
export function getCatalogLore(entry: LoreBearing | null | undefined): string {
  const text = entry?.lore?.trim();
  return text ? text : LORE_PLACEHOLDER;
}

/** True when the entry carries real lore (used to style the placeholder
 *  state distinctly). */
export function hasCatalogLore(entry: LoreBearing | null | undefined): boolean {
  return Boolean(entry?.lore?.trim());
}
