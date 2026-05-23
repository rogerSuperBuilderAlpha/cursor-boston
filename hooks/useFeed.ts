/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Timestamp } from "firebase/firestore";
import { User } from "firebase/auth";
import type { Message, ReactionType } from "@/types/feed";

const PAGE_SIZE = 20;

interface FeedApiMessage extends Omit<Message, "createdAt"> {
  createdAt: string;
}

interface FeedApiResponse {
  messages?: FeedApiMessage[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

function toMessage(message: FeedApiMessage): Message {
  const parsed = Date.parse(message.createdAt);
  return {
    ...message,
    createdAt: Timestamp.fromDate(Number.isFinite(parsed) ? new Date(parsed) : new Date()),
  };
}

export function useFeed(user: User | null, isActive: boolean) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [feedSearchQuery, setFeedSearchQuery] = useState("");
  
  // Social features state
  const [userReactions, setUserReactions] = useState<Record<string, ReactionType>>({});
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [messageReplies, setMessageReplies] = useState<Record<string, Message[]>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [repostingMessage, setRepostingMessage] = useState<Message | null>(null);
  const [repostComment, setRepostComment] = useState("");

  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }, [user]);

  const loadFeedPage = useCallback(
    async (params: URLSearchParams) => {
      const headers = await authHeaders();
      const response = await fetch(`/api/community/feed?${params.toString()}`, { headers });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as FeedApiResponse;
      return {
        messages: (data.messages ?? []).map(toMessage),
        nextCursor: data.nextCursor ?? null,
        hasMore: data.hasMore ?? false,
      };
    },
    [authHeaders]
  );

  // Fetch messages through the server feed endpoint so moderation and block
  // filters are applied consistently instead of relying on public Firestore reads.
  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      const page = await loadFeedPage(params);
      setMessages(page.messages);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setError("Failed to load feed. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [loadFeedPage]);

  // Load messages on mount and poll every 30s while active (server endpoint,
  // not onSnapshot, to avoid real-time listener fan-out).
  useEffect(() => {
    if (!isActive) return;
    const timeout = window.setTimeout(() => {
      void fetchMessages();
    }, 0);
    const interval = setInterval(fetchMessages, 30_000);
    return () => {
      window.clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [isActive, fetchMessages]);

  // Load more messages using cursor-based pagination
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        cursor: nextCursor,
        limit: String(PAGE_SIZE),
      });
      const page = await loadFeedPage(params);

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const deduped = page.messages.filter((m) => !existingIds.has(m.id));
        return [...prev, ...deduped];
      });
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (error) {
      console.error("Error loading more messages:", error);
      setError("Failed to load more messages.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loadFeedPage, nextCursor]);

  const visibleMessageIdsKey = useMemo(
    () => [...messages.map((m) => m.id)].sort().join("\0"),
    [messages]
  );

  // Reactions for visible feed messages only (bounded reads vs. full user history scan).
  useEffect(() => {
    if (!isActive || !user) {
      if (!user) {
        const timeout = window.setTimeout(() => setUserReactions({}), 0);
        return () => window.clearTimeout(timeout);
      }
      return;
    }
    if (messages.length === 0) {
      const timeout = window.setTimeout(() => setUserReactions({}), 0);
      return () => window.clearTimeout(timeout);
    }

    (async () => {
      try {
        const ids = [...messages.map((m) => m.id)].slice(0, 60);
        const token = await user.getIdToken();
        const res = await fetch(
          `/api/community/my-reactions?messageIds=${encodeURIComponent(ids.join(","))}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { reactions?: Record<string, ReactionType> };
        setUserReactions(data.reactions ?? {});
      } catch (error) {
        console.error("Error fetching reactions:", error);
      }
    })();
    return undefined;
    // `visibleMessageIdsKey` is derived from `messages` and limits refetches to id-set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: deps via visibleMessageIdsKey
  }, [isActive, user, visibleMessageIdsKey]);

  // API helper
  const callCommunityApi = useCallback(
    async (endpoint: string, payload: Record<string, unknown>) => {
      if (!user) {
        throw new Error("Not authenticated");
      }
      const token = await user.getIdToken();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Request failed");
      }

      return response.json();
    },
    [user]
  );

  // Post a new message (routed through API for server-side validation)
  const postMessage = async () => {
    const trimmed = newMessage.trim();
    if (!user || !trimmed || trimmed.length < 100 || trimmed.length > 500) return;

    setPosting(true);
    try {
      const response = await callCommunityApi("/api/community/post", {
        content: trimmed,
      });

      setMessages((prev) => [
        {
          id: response.messageId,
          content: trimmed,
          authorId: user.uid,
          authorName: user.displayName || user.email?.split("@")[0] || "Anonymous",
          authorPhoto: user.photoURL,
          createdAt: Timestamp.now(),
          likeCount: 0,
          dislikeCount: 0,
          replyCount: 0,
          repostCount: 0,
        },
        ...prev,
      ]);
      setNewMessage("");
    } catch (error) {
      setError("Failed to post message. Please try again.");
      console.error("Error posting message:", error);
    } finally {
      setPosting(false);
    }
  };

  // Delete a message (routed through API for server-side ownership verification)
  const deleteMessage = async (messageId: string) => {
    if (!user) return;

    try {
      await callCommunityApi("/api/community/delete", { messageId });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setMessageReplies((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          updated[key] = updated[key].filter((m) => m.id !== messageId);
        });
        return updated;
      });
    } catch (error) {
      setError("Failed to delete message. Please try again.");
      console.error("Error deleting message:", error);
    }
  };

  // Toggle like/dislike reaction
  const toggleReaction = useCallback(async (messageId: string, type: ReactionType) => {
    if (!user) return;
    
    const currentReaction = userReactions[messageId];
    
    const updateMessage = (updater: (msg: Message) => Message) => {
      setMessages((prev) => prev.map((m) => m.id === messageId ? updater(m) : m));
      setMessageReplies((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          updated[key] = updated[key].map((m) => m.id === messageId ? updater(m) : m);
        });
        return updated;
      });
    };
    
    try {
      if (currentReaction === type) {
        setUserReactions((prev) => {
          const updated = { ...prev };
          delete updated[messageId];
          return updated;
        });
        updateMessage((m) => ({
          ...m,
          [type === "like" ? "likeCount" : "dislikeCount"]: Math.max(
            0,
            (m[type === "like" ? "likeCount" : "dislikeCount"] || 0) - 1
          ),
        }));
      } else {
        setUserReactions((prev) => ({ ...prev, [messageId]: type }));

        if (currentReaction) {
          updateMessage((m) => ({
            ...m,
            [currentReaction === "like" ? "likeCount" : "dislikeCount"]: Math.max(
              0,
              (m[currentReaction === "like" ? "likeCount" : "dislikeCount"] || 0) - 1
            ),
            [type === "like" ? "likeCount" : "dislikeCount"]:
              (m[type === "like" ? "likeCount" : "dislikeCount"] || 0) + 1,
          }));
        } else {
          updateMessage((m) => ({
            ...m,
            [type === "like" ? "likeCount" : "dislikeCount"]:
              (m[type === "like" ? "likeCount" : "dislikeCount"] || 0) + 1,
          }));
        }
      }

      const result = await callCommunityApi("/api/community/reaction", {
        messageId,
        type,
      });

      if (result?.action === "removed") {
        setUserReactions((prev) => {
          const updated = { ...prev };
          delete updated[messageId];
          return updated;
        });
      } else if (result?.action === "added" || result?.action === "switched") {
        setUserReactions((prev) => ({ ...prev, [messageId]: result.type || type }));
      }
    } catch (error) {
      console.error("Error toggling reaction:", error);
      if (currentReaction) {
        setUserReactions((prev) => ({ ...prev, [messageId]: currentReaction }));
      } else {
        setUserReactions((prev) => {
          const updated = { ...prev };
          delete updated[messageId];
          return updated;
        });
      }
    }
  }, [user, userReactions, callCommunityApi]);

  // Fetch replies for a message
  const fetchReplies = useCallback(async (parentId: string) => {
    try {
      const params = new URLSearchParams({
        parentId,
        limit: "100",
      });
      const page = await loadFeedPage(params);
      setMessageReplies((prev) => ({ ...prev, [parentId]: page.messages }));
    } catch (error) {
      console.error("Error fetching replies:", error);
    }
  }, [loadFeedPage]);

  // Toggle reply expansion
  const toggleReplies = useCallback((messageId: string) => {
    setExpandedReplies((prev) => {
      const updated = new Set(Array.from(prev));
      if (updated.has(messageId)) {
        updated.delete(messageId);
      } else {
        updated.add(messageId);
        if (!messageReplies[messageId]) {
          fetchReplies(messageId);
        }
      }
      return updated;
    });
  }, [messageReplies, fetchReplies]);

  // Post a reply
  const postReply = async (parentId: string) => {
    const trimmed = replyContent.trim();
    if (!user || !trimmed || trimmed.length < 100 || trimmed.length > 500) return;
    
    setPostingReply(true);
    try {
      const response = await callCommunityApi("/api/community/reply", {
        parentId,
        content: trimmed,
      });

      const newReplyWithId: Message = {
        id: response.replyId,
        content: trimmed,
        authorId: user.uid,
        authorName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        authorPhoto: user.photoURL,
        createdAt: Timestamp.now(),
        parentId,
        likeCount: 0,
        dislikeCount: 0,
        replyCount: 0,
        repostCount: 0,
      };

      setMessageReplies((prev) => ({
        ...prev,
        [parentId]: [...(prev[parentId] || []), newReplyWithId],
      }));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === parentId ? { ...m, replyCount: (m.replyCount || 0) + 1 } : m
        )
      );
      
      setReplyContent("");
      setReplyingTo(null);
      setExpandedReplies((prev) => new Set([...Array.from(prev), parentId]));
    } catch (error) {
      setError("Failed to post reply. Please try again.");
      console.error("Error posting reply:", error);
    } finally {
      setPostingReply(false);
    }
  };

  // Repost a message
  const repostMessage = async (original: Message) => {
    const trimmed = repostComment.trim();
    if (!user || !trimmed || trimmed.length < 100 || trimmed.length > 500) return;
    
    setPosting(true);
    try {
      const response = await callCommunityApi("/api/community/repost", {
        originalId: original.id,
        content: trimmed,
      });

      const repost = {
        content: trimmed,
        authorId: user.uid,
        authorName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        authorPhoto: user.photoURL,
        createdAt: Timestamp.now(),
        repostOf: {
          originalId: original.id,
          originalAuthorId: original.authorId,
          originalAuthorName: original.authorName,
          originalContent: original.content,
        },
        likeCount: 0,
        dislikeCount: 0,
        replyCount: 0,
        repostCount: 0,
      };

      setMessages((prev) => [
        {
          id: response.repostId,
          ...repost,
        },
        ...prev.map((m) =>
          m.id === original.id ? { ...m, repostCount: (m.repostCount || 0) + 1 } : m
        ),
      ]);
      
      setRepostingMessage(null);
      setRepostComment("");
    } catch (error) {
      setError("Failed to repost. Please try again.");
      console.error("Error reposting:", error);
    } finally {
      setPosting(false);
    }
  };

  // Filter messages by search query
  const filteredMessages = useMemo(() => {
    if (!feedSearchQuery.trim()) return messages;
    const query = feedSearchQuery.toLowerCase();
    return messages.filter((msg) => {
      const content = msg.content?.toLowerCase() || "";
      const author = msg.authorName?.toLowerCase() || "";
      const originalContent = msg.repostOf?.originalContent?.toLowerCase() || "";
      return content.includes(query) || author.includes(query) || originalContent.includes(query);
    });
  }, [messages, feedSearchQuery]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
    clearError,
    newMessage,
    setNewMessage,
    posting,
    feedSearchQuery,
    setFeedSearchQuery,
    filteredMessages,
    userReactions,
    expandedReplies,
    messageReplies,
    replyingTo,
    setReplyingTo,
    replyContent,
    setReplyContent,
    postingReply,
    repostingMessage,
    setRepostingMessage,
    repostComment,
    setRepostComment,
    postMessage,
    deleteMessage,
    toggleReaction,
    toggleReplies,
    postReply,
    repostMessage,
  };
}
