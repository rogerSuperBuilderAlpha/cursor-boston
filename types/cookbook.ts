/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export const COOKBOOK_CATEGORIES = [
  "debugging",
  "refactoring",
  "code-generation",
  "testing",
  "documentation",
  "architecture",
  "performance",
  "devops",
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
  "Swift",
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
