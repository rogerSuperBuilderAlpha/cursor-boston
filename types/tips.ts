/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export const TIP_CATEGORIES = [
  "Keyboard Shortcuts",
  "Prompt Tricks",
  "Workflow Hacks",
  "Extensions & Tools",
  "AI Concepts",
  "General",
] as const;

export type TipCategory = (typeof TIP_CATEGORIES)[number];

export type TipStatus = "pending" | "scheduled" | "published";

export interface WeeklyTip {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  category: TipCategory;
  status: TipStatus;
  createdAt: string;
  publishedAt?: string;
  weekOf?: string;
}

export interface TipSubscriber {
  email: string;
  name?: string;
  subscribedAt: string;
  unsubscribed: boolean;
  unsubscribedAt?: string;
}
