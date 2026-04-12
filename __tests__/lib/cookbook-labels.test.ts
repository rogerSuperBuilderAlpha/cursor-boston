/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { CATEGORY_LABELS } from "@/lib/cookbook-labels";
import { COOKBOOK_CATEGORIES } from "@/types/cookbook";

describe("CATEGORY_LABELS", () => {
  it("has a label for every cookbook category", () => {
    for (const category of COOKBOOK_CATEGORIES) {
      expect(CATEGORY_LABELS[category]).toBeDefined();
      expect(typeof CATEGORY_LABELS[category]).toBe("string");
      expect(CATEGORY_LABELS[category].length).toBeGreaterThan(0);
    }
  });

  it("contains expected categories", () => {
    expect(CATEGORY_LABELS.debugging).toBe("Debugging");
    expect(CATEGORY_LABELS.refactoring).toBe("Refactoring");
    expect(CATEGORY_LABELS["code-generation"]).toBe("Code Generation");
    expect(CATEGORY_LABELS.other).toBe("Other");
  });
});
