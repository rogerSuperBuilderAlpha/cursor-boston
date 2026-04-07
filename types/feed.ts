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
