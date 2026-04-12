/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { User } from "firebase/auth";
import { useFeed } from "@/hooks/useFeed";
import { PostComposer } from "./PostComposer";
import { MessageCard } from "./MessageCard";
import { RepostModal } from "./RepostModal";
import { FeedMessageSkeleton } from "@/components/skeletons/FeedMessageSkeleton";

interface CommunityFeedProps {
  user: User | null;
  onViewMemberProfile: (authorName: string) => void;
}

export function CommunityFeed({ user, onViewMemberProfile }: CommunityFeedProps) {
  const {
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
  } = useFeed(user, true);

  return (
    <section className="py-8 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Repost Modal */}
        {repostingMessage && (
          <RepostModal
            message={repostingMessage}
            comment={repostComment}
            onCommentChange={setRepostComment}
            onSubmit={() => repostMessage(repostingMessage)}
            onCancel={() => {
              setRepostingMessage(null);
              setRepostComment("");
            }}
            posting={posting}
          />
        )}

        {/* Feed Search */}
        <div className="relative mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={feedSearchQuery}
            onChange={(e) => setFeedSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full pl-11 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
          />
          {feedSearchQuery && (
            <button
              onClick={() => setFeedSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-1"
              aria-label="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search Results Count */}
        {feedSearchQuery && (
          <p className="text-sm text-neutral-500 mb-4">
            {filteredMessages.length} result{filteredMessages.length !== 1 ? "s" : ""} for &quot;{feedSearchQuery}&quot;
          </p>
        )}

        {/* Post Message Box */}
        <PostComposer
          user={user}
          value={newMessage}
          onChange={setNewMessage}
          onSubmit={postMessage}
          posting={posting}
        />

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-between gap-4 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={clearError}
              className="text-sm text-red-400 hover:text-red-300 underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Messages Feed */}
        {loading ? (
          <div className="space-y-4">
            <FeedMessageSkeleton />
            <FeedMessageSkeleton />
            <FeedMessageSkeleton />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-400 text-lg mb-2">
              {feedSearchQuery ? "No messages match your search" : "No messages yet"}
            </p>
            <p className="text-neutral-500 text-sm">
              {feedSearchQuery ? (
                <button
                  onClick={() => setFeedSearchQuery("")}
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  Clear search
                </button>
              ) : (
                "Be the first to post something!"
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMessages.map((message) => (
              <MessageCard
                key={message.id}
                message={message}
                isOwner={user?.uid === message.authorId}
                isLoggedIn={!!user}
                userReaction={userReactions[message.id]}
                onDelete={() => deleteMessage(message.id)}
                onAuthorClick={() => onViewMemberProfile(message.authorName)}
                onLike={() => toggleReaction(message.id, "like")}
                onDislike={() => toggleReaction(message.id, "dislike")}
                onReply={() => setReplyingTo(replyingTo === message.id ? null : message.id)}
                onRepost={() => setRepostingMessage(message)}
                showReplyInput={replyingTo === message.id}
                replyContent={replyContent}
                onReplyContentChange={setReplyContent}
                onSubmitReply={() => postReply(message.id)}
                postingReply={postingReply}
                replies={messageReplies[message.id] || []}
                showReplies={expandedReplies.has(message.id)}
                onToggleReplies={() => toggleReplies(message.id)}
                onReplyLike={(replyId) => toggleReaction(replyId, "like")}
                onReplyDislike={(replyId) => toggleReaction(replyId, "dislike")}
                onDeleteReply={(replyId) => deleteMessage(replyId)}
                replyReactions={userReactions}
                currentUserId={user?.uid}
              />
            ))}
            {hasMore && !feedSearchQuery && (
              <div className="flex justify-center pt-4 pb-2">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 text-sm font-medium text-neutral-300 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
