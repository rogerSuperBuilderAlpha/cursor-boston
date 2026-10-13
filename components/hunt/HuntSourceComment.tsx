/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/** Renders an HTML comment into the page for view-source puzzle clues. */
export function HuntSourceComment({ text }: { text: string }) {
  return (
    <div
      className="hidden"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: `<!-- ${text} -->` }}
    />
  );
}
