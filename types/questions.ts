/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export const QUESTION_TAGS = [
  "cursor-rules",
  "prompting",
  "debugging",
  "refactoring",
  "testing",
  "architecture",
  "performance",
  "workflows",
  "mcp",
  "agents",
  "other",
] as const;

export type QuestionTag = (typeof QUESTION_TAGS)[number];

export type VoteType = "up" | "down";

export type QuestionSort = "newest" | "top" | "unanswered";

export interface Question {
  id: string;
  title: string;
  body: string;
  tags: QuestionTag[];
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  createdAt: string;
  updatedAt: string;
  upCount: number;
  downCount: number;
  netScore: number;
  answerCount: number;
}

export interface Answer {
  id: string;
  questionId: string;
  body: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  createdAt: string;
  updatedAt: string;
  upCount: number;
  downCount: number;
  netScore: number;
  isAccepted: boolean;
}

export interface VoteResult {
  action: "added" | "removed" | "switched";
  type: VoteType;
  previousType?: VoteType;
  upCount: number;
  downCount: number;
  netScore: number;
}
