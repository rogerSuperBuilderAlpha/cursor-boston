/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { CLASS_GROUPS, TAILWIND_CLASS_NAMES } from "@/lib/classname-constants";

function collectStringLeaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];

  return Object.values(value).flatMap(collectStringLeaves);
}

describe("Tailwind class constants", () => {
  it("exposes at least 50 atomic Tailwind class tokens", () => {
    const tokens = collectStringLeaves(TAILWIND_CLASS_NAMES).flatMap((value) =>
      value.split(/\s+/)
    );

    expect(new Set(tokens).size).toBeGreaterThanOrEqual(50);
  });

  it("keeps grouped component classes built from the shared tokens", () => {
    expect(CLASS_GROUPS.form.inputDark).toContain("focus:ring-emerald-400");
    expect(CLASS_GROUPS.badge.earnedPill).toBe(
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    );
    expect(CLASS_GROUPS.vote.column).toContain("min-w-[40px]");
  });
});
