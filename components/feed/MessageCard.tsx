/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import type { Message, ReactionType } from "@/types/feed";
import { formatRelativeDate } from "@/lib/utils";
import { ReplyCard } from "./ReplyCard";
import { ReportMessageMenu } from "./ReportMessageMenu";
import { CLASS_GROUPS as CG, TAILWIND_CLASS_NAMES as TW } from "@/lib/classname-constants";
import { cn } from "@/lib/utils";

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
    <div className={cn(TW.surface.normal, TW.radius.xl, TW.spacing.p4, TW.border.neutral)}>
  {/* Repost Header */ } {/*"bg-white dark:bg-neutral-900*/}
      {isRepost && (
        <div className={cn(CG.general.flexMid, TW.spacing.gap2, TW.text.muted, TW.text.sm, TW.spacing.mb3, TW.spacing.pb3, TW.border.bottomNeutral)}>
        {/*flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm mb-3 pb-3 border-b border-neutral-200 dark:border-neutral-800*/}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <button
            onClick={onAuthorClick}
            aria-label={`View ${message.authorName}'s profile`}
            className={cn(TW.text.accentSharpHover, TW.motion.colors)}
          > {/*hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors */}
            {message.authorName}
          </button>
          <span>reposted</span>
        </div>
      )}

      <div className={cn(TW.layout.flex, TW.spacing.gap3)}>
        <button
          onClick={onAuthorClick}
          aria-label={`View ${message.authorName}'s profile`}
          className={cn(TW.layout.shrink0, TW.focus.emerald, TW.radius.full)}
        >
          <Avatar
            src={message.authorPhoto}
            name={message.authorName}
            size={40}
            className={cn(TW.surface.hover80Trans)}
          />
        </button>
        <div className={cn(TW.layout.flex1, TW.layout.minW0)}>
          <div className={cn(CG.general.flexMid, TW.layout.justifyBetween, TW.spacing.gap2)}>
            <div className={cn(CG.general.flexMid, TW.spacing.gap2, TW.layout.minW0)}>
              <button
                onClick={onAuthorClick}
                aria-label={`View ${message.authorName}'s profile`}
                className={cn(TW.text.medium, TW.text.normal, TW.layout.truncate, TW.text.accentSharpHover, TW.motion.colors, TW.focus.emerald700Dark400)}
              > {/* font-medium text-neutral-900 dark:text-white truncate hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:text-emerald-700 dark:focus-visible:text-emerald-400 */}
                {message.authorName}
              </button>
              <span className={cn(TW.text.muted, TW.text.sm, TW.layout.shrink0)}>
                {formatRelativeDate(message.createdAt)}
              </span> {/* "text-neutral-600 dark:text-neutral-400 text-sm shrink-0" */}
            </div>
            {isOwner ? (
              <div className={cn(TW.layout.relative)}>
                {showDeleteConfirm ? (
                  <div className={cn(CG.general.flexMid, TW.spacing.gap2)}>
                    <button
                      onClick={() => {
                        onDelete();
                        setShowDeleteConfirm(false);
                      }}
                      className={cn(CG.button.size32, TW.text.sm, TW.text.red, TW.text.redHover, CG.button.positioning1)}
                    > {/* "px-3 py-2 text-sm text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 min-h-[44px] flex items-center" */}
                      Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className={cn(CG.button.size32, TW.text.sm, TW.text.muted, TW.text.normalHover, CG.button.positioning1)}
                    > {/* "px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white min-h-[44px] flex items-center" */}
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                      className={cn(TW.text.muted, TW.text.gray1Hover, TW.spacing.p2, TW.sizing.control44, CG.general.flexMid, TW.layout.justifyCenter, TW.motion.colors)}
                    aria-label="Delete message"
                  > {/* "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-300 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors" */}
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
            ) : isLoggedIn ? (
              <ReportMessageMenu messageId={message.id} />
            ) : null}
          </div>
          {/* Reposter's comment */}
          <p className={cn(TW.text.body, TW.spacing.mt1, CG.general.wPreWrapBreakWord)}>
            {message.content}
          </p> {/* "text-neutral-700 dark:text-neutral-300 mt-1 whitespace-pre-wrap wrap-break-word" */}
          
          {/* Original message being reposted */}
          {isRepost && (
            <div className={cn(TW.spacing.mt3, TW.spacing.p3, TW.surface.neutral2, TW.radius.lg, TW.border.l4, TW.border.emerald500_50)}>
              <div className={cn(CG.general.flexMid, TW.spacing.gap2, TW.spacing.mb2)}>
                <span className={cn(TW.text.sm, TW.text.medium, TW.text.muted)}>
                  {message.repostOf!.originalAuthorName}
                </span>
              </div>
              <p className={cn(TW.text.body, TW.text.sm, CG.general.wPreWrapBreakWord)}>
                {message.repostOf!.originalContent}
              </p>
            </div>
          )}

          {/* Reaction Buttons */}
          <div className={cn(CG.general.flexMid, TW.spacing.gap1, TW.spacing.mt3, TW.spacing.pt3, TW.border.topNeutral, TW.layout.margin_left2)}>
            {/* Like */}
            <button
              onClick={onLike}
              disabled={!isLoggedIn}
              className={`${CG.general.flexMid} ${TW.spacing.gap1_5} ${CG.button.size32} ${TW.radius.lg} ${TW.motion.colors} ${TW.sizing.minh44} ${userReaction === "like"
                  ? `${TW.text.accentSharp} ${TW.surface.emeraldSoft}`
                  : `${TW.text.muted} ${TW.text.accentSharpHover} ${TW.surface.neutralSoftHover}`
                } ${!isLoggedIn ? TW.state.disabled : ""}`}
              aria-label={
                userReaction === "like"
                  ? `Remove like from ${message.authorName}'s message`
                  : `Like ${message.authorName}'s message`
              }
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
              <span className={cn(TW.text.sm)}>{message.likeCount || 0}</span>
            </button>

            {/* Dislike */}
            <button
              onClick={onDislike}
              disabled={!isLoggedIn}
              className={`${CG.general.flexMid} ${TW.spacing.gap1_5} ${CG.button.size32} ${TW.radius.lg} ${TW.motion.colors} ${TW.sizing.minh44} ${
                userReaction === "dislike"
                  ? `${TW.text.red} ${TW.surface.dangerSoft}`
                  : `${TW.text.muted} ${TW.text.redHover2} ${TW.surface.neutralSoftHover}`
              } ${!isLoggedIn ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-label={
                userReaction === "dislike"
                  ? `Remove dislike from ${message.authorName}'s message`
                  : `Dislike ${message.authorName}'s message`
              }
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
              <span className={cn(TW.text.sm)}>{message.dislikeCount || 0}</span>
            </button>

            {/* Reply */}
            <button
              onClick={onReply}
              disabled={!isLoggedIn}
              className={`${CG.general.flexMid} ${TW.spacing.gap1_5} ${CG.button.size32} ${TW.radius.lg} ${TW.motion.colors} ${TW.sizing.minh44} ${
                showReplyInput
                  ? `${TW.text.accentSharp} ${TW.surface.emeraldSoft}`
                  : `${TW.text.muted} ${TW.text.accentSharpHover} ${TW.surface.neutralSoftHover}`
              } ${!isLoggedIn ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-label={`Reply to ${message.authorName}'s message`}
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
              <span className={cn(TW.text.sm)}>{message.replyCount || 0}</span>
            </button>

            {/* Repost */}
            {!isRepost && (
              <button
                onClick={onRepost}
                disabled={!isLoggedIn}
                className={`${CG.general.flexMid} ${TW.spacing.gap1_5} ${CG.button.size32} ${TW.radius.lg} ${TW.motion.colors} ${TW.sizing.minh44} ${TW.text.muted} ${TW.text.accentSharpHover} ${TW.surface.neutralSoftHover} ${
                  !isLoggedIn ? "opacity-50 cursor-not-allowed" : ""
                }`}
                aria-label={`Repost ${message.authorName}'s message`}
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
                <span className={cn(TW.text.sm)}>{message.repostCount || 0}</span>
              </button>
            )}
          </div>

          {/* Reply Input */}
          {showReplyInput && (
            <div className={cn(TW.spacing.mt3, TW.spacing.pt3, TW.border.topNeutral)}>
              <textarea
                value={replyContent}
                onChange={(e) => onReplyContentChange(e.target.value)}
                placeholder={`Reply to ${message.authorName}...`}
                aria-label={`Reply to ${message.authorName}`}
                rows={2}
                maxLength={500}
                className={cn(TW.layout.wFull, TW.surface.neutralSoft, TW.radius.lg, TW.spacing.p3, TW.text.normal, TW.text.placeholderGray400, TW.sizing.noResize, TW.focus.foregroundEmerald)}
              />
              <div className={cn(CG.general.flexMid, TW.layout.justifyBetween, TW.spacing.mt2)}>
                <span className={`${TW.text.tiny} ${
                  replyContent.length < 100
                    ? TW.text.red
                    : replyContent.length > 500
                    ? TW.text.red
                    : TW.text.muted
                }`}>
                  {replyContent.length}/500 (minimum 100)
                </span>
                <div className={cn(TW.layout.flex, TW.spacing.gap2)}>
                  <button
                    type="button"
                    onClick={onReply}
                    className={cn(CG.button.size32, TW.text.sm, TW.text.muted, TW.text.normalHover, TW.motion.colors, TW.sizing.minh44)}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSubmitReply}
                    disabled={postingReply || replyContent.trim().length < 100 || replyContent.trim().length > 500}
                    className={cn(TW.spacing.px4, TW.spacing.py2, TW.surface.emerald2, TW.text.inverse, TW.radius.lg, TW.text.sm, TW.text.medium, TW.surface.emerald3Hover, TW.motion.colors, TW.state.disabledSoftLess, TW.sizing.minh44)}
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
              aria-expanded={showReplies}
              className={cn(TW.spacing.mt3, TW.text.sm, TW.text.accentSharp, TW.text.accentSharperHover, TW.motion.colors, CG.general.flexMid, TW.spacing.gap1)}
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
            <div className={cn(TW.spacing.mt3, TW.spacing.space_y3, TW.spacing.p_left4, TW.border.neutral12)}>
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
