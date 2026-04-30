/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";
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
      className={[
        "border rounded-xl p-4 sm:p-5 transition-colors",
        answer.isAccepted
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20"
          : "border-neutral-200 dark:border-neutral-800",
      ].join(" ")}
    >
      <div className="flex gap-4">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-1 min-w-[40px]">
          <button
            type="button"
            onClick={() => onVote(answer.id, "up")}
            disabled={!isLoggedIn || isVoting}
            aria-label={`Upvote answer by ${answer.authorName}`}
            className={[
              "p-1 rounded transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              userVote === "up"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300",
              (!isLoggedIn || isVoting) ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <ThumbsUp size={16} />
          </button>
          <span
            className={[
              "text-sm font-semibold",
              netScore > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : netScore < 0
                  ? "text-red-500"
                  : "text-neutral-500",
            ].join(" ")}
          >
            {netScore > 0 ? `+${netScore}` : netScore}
          </span>
          <button
            type="button"
            onClick={() => onVote(answer.id, "down")}
            disabled={!isLoggedIn || isVoting}
            aria-label={`Downvote answer by ${answer.authorName}`}
            className={[
              "p-1 rounded transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              userVote === "down"
                ? "text-red-500"
                : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300",
              (!isLoggedIn || isVoting) ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <ThumbsDown size={16} />
          </button>

          {/* Accept button */}
          {isQuestionAuthor && (
            <button
              type="button"
              onClick={() => onAccept(answer.id)}
              aria-label={answer.isAccepted ? "Unaccept this answer" : "Accept this answer"}
              className={[
                "p-1 rounded transition-colors mt-1",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                answer.isAccepted
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400",
              ].join(" ")}
            >
              <CheckCircle2 size={18} />
            </button>
          )}
          {!isQuestionAuthor && answer.isAccepted && (
            <span className="text-emerald-600 dark:text-emerald-400 mt-1" title="Accepted answer">
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
          <div className="flex items-center gap-2 mt-3 text-xs text-neutral-500">
            <span>{answer.authorName}</span>
            <span>&middot;</span>
            <span>{timeAgo(answer.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
