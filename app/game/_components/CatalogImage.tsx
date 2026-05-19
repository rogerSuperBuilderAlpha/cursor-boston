/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { cn } from "@/lib/utils";
import {
  getCatalogImageSrc,
  hasCatalogImage,
} from "@/lib/game/content/display";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = {
  xs: 24,
  sm: 32,
  md: 64,
  lg: 128,
  xl: 192,
};

interface CatalogImageProps {
  /** Any catalog entry that may carry imageUrl + name. */
  entry: { imageUrl?: string | null; name?: string };
  /** Visual size; pins both width + height so layout doesn't shift. */
  size?: Size;
  /** Override the alt text. Defaults to entry.name. */
  alt?: string;
  /** Extra classes — appended to the defaults (rounded, opacity-50 on fallback). */
  className?: string;
}

/**
 * Renders a catalog entry's illustration with a graceful fallback to the
 * project logo at half opacity when no `imageUrl` is set yet. Plain `<img>`
 * (no `next/image`) to match the game pages' existing pattern and avoid
 * forcing every contributor to update `next.config.js` domains when adding
 * external-host images later.
 */
export function CatalogImage({
  entry,
  size = "sm",
  alt,
  className,
}: CatalogImageProps) {
  const src = getCatalogImageSrc(entry);
  const isFallback = !hasCatalogImage(entry);
  const px = SIZE_PX[size];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- matches existing game-page pattern; see plan doc
    <img
      src={src}
      alt={alt ?? entry.name ?? ""}
      width={px}
      height={px}
      loading="lazy"
      className={cn(
        "rounded-md shrink-0 object-cover",
        isFallback && "opacity-50",
        className,
      )}
    />
  );
}
