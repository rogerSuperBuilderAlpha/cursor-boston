export const COOKBOOK_CATEGORIES = [
  "debugging",
  "refactoring",
  "code-generation",
  "testing",
  "documentation",
  "architecture",
  "other",
] as const;

export type CookbookCategory = (typeof COOKBOOK_CATEGORIES)[number];

export const WORKS_WITH_LANGUAGES = [
  "Python",
  "TypeScript",
  "JavaScript",
  "React",
  "Next.js",
  "Node.js",
  "Go",
  "Rust",
  "Java",
  "C#",
  "Ruby",
  "Other",
] as const;

export type WorksWithTag = (typeof WORKS_WITH_LANGUAGES)[number];

export interface CookbookEntry {
  id: string;
  title: string;
  description: string;
  promptContent: string;
  category: CookbookCategory;
  tags: string[];
  worksWith: WorksWithTag[];
  authorId: string;
  authorDisplayName: string;
  createdAt: string;
  upCount: number;
  downCount: number;
}
