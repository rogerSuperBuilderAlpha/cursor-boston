/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Timestamp } from "firebase/firestore";

export type ReactionType = "like" | "dislike" | "bookmark";

export interface RepostData {
  originalId: string;
  originalAuthorId: string;
  originalAuthorName: string;
  originalContent: string;
}

export interface Message {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  createdAt: Timestamp;
  // Social features
  parentId?: string;
  repostOf?: RepostData;
  likeCount?: number;
  dislikeCount?: number;
  replyCount?: number;
  repostCount?: number;
  bookmarkCount?: number;
}

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  type: ReactionType;
}
