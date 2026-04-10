/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { CookbookCategory } from "@/types/cookbook";

/** Human-readable display labels for each cookbook category. */
export const CATEGORY_LABELS: Record<CookbookCategory, string> = {
  debugging: "Debugging",
  refactoring: "Refactoring",
  "code-generation": "Code Generation",
  testing: "Testing",
  documentation: "Documentation",
  architecture: "Architecture",
  performance: "Performance",
  devops: "DevOps",
  other: "Other",
};
