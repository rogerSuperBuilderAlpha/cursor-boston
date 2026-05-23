/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";
import { CLASS_GROUPS, TAILWIND_CLASS_NAMES as TW } from "@/lib/classname-constants";
import { cn } from "@/lib/utils";
import type { Answer, VoteType } from "@/types/questions";

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

export function AnswerCard({
  answer,
  userVote,
  isLoggedIn,
  isVoting,
  isQuestionAuthor,
  onVote,
  onAccept,
}: {
  answer: Answer;
  userVote?: VoteType;
  isLoggedIn: boolean;
  isVoting: boolean;
  isQuestionAuthor: boolean;
  onVote: (answerId: string, type: VoteType) => void;
  onAccept: (answerId: string) => void;
}) {
  const netScore = answer.upCount - answer.downCount;

  return (
    <div
      className={cn(
        TW.border.base,
        TW.radius.xl,
        "p-4 sm:p-5",
        TW.motion.colors,
        answer.isAccepted
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20"
          : "border-neutral-200 dark:border-neutral-800"
      )}
    >
      <div className="flex gap-4">
        {/* Vote column */}
        <div className={CLASS_GROUPS.vote.column}>
          <button
            type="button"
            onClick={() => onVote(answer.id, "up")}
            disabled={!isLoggedIn || isVoting}
            aria-label={`Upvote answer by ${answer.authorName}`}
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
            onClick={() => onVote(answer.id, "down")}
            disabled={!isLoggedIn || isVoting}
            aria-label={`Downvote answer by ${answer.authorName}`}
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

          {/* Accept button */}
          {isQuestionAuthor && (
            <button
              type="button"
              onClick={() => onAccept(answer.id)}
              aria-label={answer.isAccepted ? "Unaccept this answer" : "Accept this answer"}
              className={cn(
                CLASS_GROUPS.button.iconAction,
                TW.spacing.mt1,
                answer.isAccepted
                  ? TW.text.accent
                  : "text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400"
              )}
            >
              <CheckCircle2 size={18} />
            </button>
          )}
          {!isQuestionAuthor && answer.isAccepted && (
            <span className={cn(TW.text.accent, TW.spacing.mt1)} title="Accepted answer">
              <CheckCircle2 size={18} />
            </span>
          )}
        </div>

        {/* Content column */}
        <div className="flex-1 min-w-0">
          {answer.isAccepted && (
            <span className="inline-block text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded mb-2">
              Accepted Answer
            </span>
          )}
          <p className="text-sm text-foreground whitespace-pre-wrap">{answer.body}</p>
          <div className={cn(TW.layout.flex, TW.layout.itemsCenter, TW.spacing.gap2, TW.spacing.mt3, CLASS_GROUPS.text.metadata)}>
            <span>{answer.authorName}</span>
            <span>&middot;</span>
            <span>{timeAgo(answer.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
