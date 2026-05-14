/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { cn } from "@/lib/utils";
import {
  getCatalogLore,
  hasCatalogLore,
} from "@/lib/game/content/display";

interface CatalogLoreProps {
  /** Any catalog entry that may carry a lore field. */
  entry: { lore?: string | null };
  /** Extra classes appended to the defaults. */
  className?: string;
}

/**
 * Renders a catalog entry's long-form lore. Falls back to a faded "No lore
 * yet." placeholder so the visual indicates a real-but-empty slot rather
 * than a missing UI element. Styling distinguishes placeholder (italic,
 * muted) from real lore (regular weight, primary copy color).
 */
export function CatalogLore({ entry, className }: CatalogLoreProps) {
  const text = getCatalogLore(entry);
  const isPlaceholder = !hasCatalogLore(entry);
  return (
    <p
      className={cn(
        "text-sm leading-relaxed",
        isPlaceholder
          ? "italic text-neutral-500 dark:text-neutral-500"
          : "text-neutral-700 dark:text-neutral-300",
        className,
      )}
    >
      {text}
    </p>
  );
}
