"use client";

import { User } from "firebase/auth";
import { useFeed } from "@/hooks/useFeed";
import { PostComposer } from "./PostComposer";
import { MessageCard } from "./MessageCard";
import { RepostModal } from "./RepostModal";

interface CommunityFeedProps {
  user: User | null;
  onViewMemberProfile: (authorName: string) => void;
}

export function CommunityFeed({ user, onViewMemberProfile }: CommunityFeedProps) {
  const {
    loading,
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

        {/* Messages Feed */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
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
          </div>
        )}
      </div>
    </section>
  );
}
