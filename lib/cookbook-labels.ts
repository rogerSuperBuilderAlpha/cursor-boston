import type { CookbookCategory } from "@/types/cookbook";

/** Human-readable display labels for each cookbook category. */
export const CATEGORY_LABELS: Record<CookbookCategory, string> = {
  debugging: "Debugging",
  refactoring: "Refactoring",
  "code-generation": "Code Generation",
  testing: "Testing",
  documentation: "Documentation",
  architecture: "Architecture",
  other: "Other",
};
