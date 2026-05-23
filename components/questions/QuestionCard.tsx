/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { CLASS_GROUPS, TAILWIND_CLASS_NAMES as TW } from "@/lib/classname-constants";
import { cn } from "@/lib/utils";
import type { Question, VoteType } from "@/types/questions";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function QuestionCard({
  question,
  userVote,
  isLoggedIn,
  isVoting,
  onVote,
  onTagClick,
}: {
  question: Question;
  userVote?: VoteType;
  isLoggedIn: boolean;
  isVoting: boolean;
  onVote: (questionId: string, type: VoteType) => void;
  onTagClick?: (tag: string) => void;
}) {
  const netScore = question.upCount - question.downCount;

  return (
    <div className={cn(TW.border.neutral, TW.radius.xl, "p-4 sm:p-5", CLASS_GROUPS.card.neutralHover, TW.motion.colors)}>
      <div className="flex gap-4">
        {/* Vote column */}
        <div className={CLASS_GROUPS.vote.column}>
          <button
            type="button"
            onClick={() => onVote(question.id, "up")}
            disabled={!isLoggedIn || isVoting}
            aria-label={`Upvote question: ${question.title}`}
            className={cn(
              CLASS_GROUPS.button.iconAction,
              userVote === "up"
                ? TW.text.accent
                : CLASS_GROUPS.vote.inactive,
              (!isLoggedIn || isVoting) && TW.state.disabled
            )}
          >
            <ThumbsUp size={16} />
          </button>
          <span
            className={cn(
              CLASS_GROUPS.vote.score,
              netScore > 0
                ? CLASS_GROUPS.status.positiveScore
                : netScore < 0
                  ? CLASS_GROUPS.status.negativeScore
                  : CLASS_GROUPS.status.neutralScore
            )}
          >
            {netScore > 0 ? `+${netScore}` : netScore}
          </span>
          <button
            type="button"
            onClick={() => onVote(question.id, "down")}
            disabled={!isLoggedIn || isVoting}
            aria-label={`Downvote question: ${question.title}`}
            className={cn(
              CLASS_GROUPS.button.iconAction,
              userVote === "down"
                ? CLASS_GROUPS.status.negativeScore
                : CLASS_GROUPS.vote.inactive,
              (!isLoggedIn || isVoting) && TW.state.disabled
            )}
          >
            <ThumbsDown size={16} />
          </button>
        </div>

        {/* Content column */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/questions/${question.id}`}
            className="text-base font-semibold text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors line-clamp-2 focus-visible:outline-none focus-visible:underline"
          >
            {question.title}
          </Link>

          <p className={cn(CLASS_GROUPS.text.muted, TW.spacing.mt1, "line-clamp-2")}>
            {question.body}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {question.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                className={cn(CLASS_GROUPS.tag.neutral, "hover:bg-neutral-200 dark:hover:bg-neutral-700", TW.motion.colors)}
              >
                {tag}
              </button>
            ))}

            <span className={cn(TW.layout.flex, TW.layout.itemsCenter, TW.spacing.gap1, CLASS_GROUPS.text.metadata, TW.spacing.mlAuto)}>
              <MessageSquare size={14} />
              {question.answerCount} {question.answerCount === 1 ? "answer" : "answers"}
            </span>

            <span className={CLASS_GROUPS.text.metadata}>
              {question.authorName} &middot; {timeAgo(question.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
