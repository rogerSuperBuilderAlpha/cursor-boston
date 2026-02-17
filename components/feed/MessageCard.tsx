"use client";

import { useState } from "react";
import Image from "next/image";
import type { Message, ReactionType } from "@/types/feed";
import { getInitials, formatRelativeDate } from "@/lib/utils";
import { ReplyCard } from "./ReplyCard";

interface MessageCardProps {
  message: Message;
  isOwner: boolean;
  isLoggedIn: boolean;
  userReaction?: ReactionType;
  onDelete: () => void;
  onAuthorClick: () => void;
  onLike: () => void;
  onDislike: () => void;
  onReply: () => void;
  onRepost: () => void;
  showReplyInput: boolean;
  replyContent: string;
  onReplyContentChange: (content: string) => void;
  onSubmitReply: () => void;
  postingReply: boolean;
  replies: Message[];
  showReplies: boolean;
  onToggleReplies: () => void;
  onReplyLike: (replyId: string) => void;
  onReplyDislike: (replyId: string) => void;
  onDeleteReply: (replyId: string) => void;
  replyReactions: Record<string, ReactionType>;
  currentUserId?: string;
}

export function MessageCard({
  message,
  isOwner,
  isLoggedIn,
  userReaction,
  onDelete,
  onAuthorClick,
  onLike,
  onDislike,
  onReply,
  onRepost,
  showReplyInput,
  replyContent,
  onReplyContentChange,
  onSubmitReply,
  postingReply,
  replies,
  showReplies,
  onToggleReplies,
  onReplyLike,
  onReplyDislike,
  onDeleteReply,
  replyReactions,
  currentUserId,
}: MessageCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isRepost = !!message.repostOf;

  return (
    <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
      {/* Repost Header */}
      {isRepost && (
        <div className="flex items-center gap-2 text-neutral-500 text-sm mb-3 pb-3 border-b border-neutral-800">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <button
            onClick={onAuthorClick}
            className="hover:text-emerald-400 transition-colors"
          >
            {message.authorName}
          </button>
          <span>reposted</span>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onAuthorClick}
          className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-full"
        >
          {message.authorPhoto ? (
            <Image
              src={message.authorPhoto}
              alt={message.authorName}
              width={40}
              height={40}
              className="rounded-full object-cover hover:opacity-80 transition-opacity"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-white font-semibold hover:bg-neutral-700 transition-colors">
              {getInitials(message.authorName)}
            </div>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={onAuthorClick}
                className="font-medium text-white truncate hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:text-emerald-400"
              >
                {message.authorName}
              </button>
              <span className="text-neutral-500 text-sm shrink-0">
                {formatRelativeDate(message.createdAt)}
              </span>
            </div>
            {isOwner && (
              <div className="relative">
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onDelete();
                        setShowDeleteConfirm(false);
                      }}
                      className="px-3 py-2 text-sm text-red-400 hover:text-red-300 min-h-[44px] flex items-center"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-2 text-sm text-neutral-400 hover:text-white min-h-[44px] flex items-center"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-neutral-500 hover:text-neutral-300 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
                    aria-label="Delete message"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="19" cy="12" r="1" />
                      <circle cx="5" cy="12" r="1" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Reposter's comment */}
          <p className="text-neutral-300 mt-1 whitespace-pre-wrap break-words">
            {message.content}
          </p>
          
          {/* Original message being reposted */}
          {isRepost && (
            <div className="mt-3 p-3 bg-neutral-800/50 rounded-lg border-l-4 border-emerald-500/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-neutral-400">
                  {message.repostOf!.originalAuthorName}
                </span>
              </div>
              <p className="text-neutral-300 text-sm whitespace-pre-wrap break-words">
                {message.repostOf!.originalContent}
              </p>
            </div>
          )}

          {/* Reaction Buttons */}
          <div className="flex items-center gap-1 mt-3 pt-3 border-t border-neutral-800 -ml-2">
            {/* Like */}
            <button
              onClick={onLike}
              disabled={!isLoggedIn}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors min-h-[44px] ${
                userReaction === "like"
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-neutral-500 hover:text-emerald-400 hover:bg-neutral-800"
              } ${!isLoggedIn ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-label={userReaction === "like" ? "Remove like" : "Like"}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={userReaction === "like" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span className="text-sm">{message.likeCount || 0}</span>
            </button>

            {/* Dislike */}
            <button
              onClick={onDislike}
              disabled={!isLoggedIn}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors min-h-[44px] ${
                userReaction === "dislike"
                  ? "text-red-400 bg-red-500/10"
                  : "text-neutral-500 hover:text-red-400 hover:bg-neutral-800"
              } ${!isLoggedIn ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-label={userReaction === "dislike" ? "Remove dislike" : "Dislike"}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={userReaction === "dislike" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
              </svg>
              <span className="text-sm">{message.dislikeCount || 0}</span>
            </button>

            {/* Reply */}
            <button
              onClick={onReply}
              disabled={!isLoggedIn}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors min-h-[44px] ${
                showReplyInput
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-neutral-500 hover:text-emerald-400 hover:bg-neutral-800"
              } ${!isLoggedIn ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-label="Reply"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-sm">{message.replyCount || 0}</span>
            </button>

            {/* Repost */}
            {!isRepost && (
              <button
                onClick={onRepost}
                disabled={!isLoggedIn}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors min-h-[44px] text-neutral-500 hover:text-emerald-400 hover:bg-neutral-800 ${
                  !isLoggedIn ? "opacity-50 cursor-not-allowed" : ""
                }`}
                aria-label="Repost"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M17 1l4 4-4 4" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="M7 23l-4-4 4-4" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                <span className="text-sm">{message.repostCount || 0}</span>
              </button>
            )}
          </div>

          {/* Reply Input */}
          {showReplyInput && (
            <div className="mt-3 pt-3 border-t border-neutral-800">
              <textarea
                value={replyContent}
                onChange={(e) => onReplyContentChange(e.target.value)}
                placeholder={`Reply to ${message.authorName}...`}
                rows={2}
                maxLength={500}
                className="w-full bg-neutral-800 rounded-lg p-3 text-white placeholder-neutral-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs ${
                  replyContent.length < 100
                    ? "text-red-400"
                    : replyContent.length > 500
                    ? "text-red-400"
                    : "text-neutral-500"
                }`}>
                  {replyContent.length}/500 (minimum 100)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={onReply}
                    className="px-3 py-2 text-sm text-neutral-400 hover:text-white transition-colors min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSubmitReply}
                    disabled={postingReply || replyContent.trim().length < 100 || replyContent.trim().length > 500}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                  >
                    {postingReply ? "Replying..." : "Reply"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* View Replies Toggle */}
          {(message.replyCount || 0) > 0 && (
            <button
              onClick={onToggleReplies}
              className="mt-3 text-sm text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${showReplies ? "rotate-90" : ""}`}
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              {showReplies ? "Hide" : "View"} {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
            </button>
          )}

          {/* Replies */}
          {showReplies && replies.length > 0 && (
            <div className="mt-3 space-y-3 pl-4 border-l-2 border-neutral-800">
              {replies.map((reply) => (
                <ReplyCard
                  key={reply.id}
                  reply={reply}
                  isOwner={currentUserId === reply.authorId}
                  userReaction={replyReactions[reply.id]}
                  onLike={() => onReplyLike(reply.id)}
                  onDislike={() => onReplyDislike(reply.id)}
                  onDelete={() => onDeleteReply(reply.id)}
                  isLoggedIn={!!currentUserId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
