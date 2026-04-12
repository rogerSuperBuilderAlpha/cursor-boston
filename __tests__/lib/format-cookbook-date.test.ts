/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { formatCookbookDate } from "@/lib/format-cookbook-date";

describe("formatCookbookDate", () => {
  it("returns empty string for falsy input", () => {
    expect(formatCookbookDate("")).toBe("");
  });

  it("formats ISO date string to short locale format", () => {
    const result = formatCookbookDate("2026-03-05T12:00:00Z");
    expect(result).toMatch(/Mar\s+5,\s+2026/);
  });

  it("handles date-only ISO string", () => {
    const result = formatCookbookDate("2026-12-25T00:00:00Z");
    expect(result).toMatch(/Dec\s+2[45],\s+2026/);
  });
});
