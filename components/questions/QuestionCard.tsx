/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
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
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 sm:p-5 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
      <div className="flex gap-4">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-1 min-w-[40px]">
          <button
            type="button"
            onClick={() => onVote(question.id, "up")}
            disabled={!isLoggedIn || isVoting}
            aria-label={`Upvote question: ${question.title}`}
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
            onClick={() => onVote(question.id, "down")}
            disabled={!isLoggedIn || isVoting}
            aria-label={`Downvote question: ${question.title}`}
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
        </div>

        {/* Content column */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/questions/${question.id}`}
            className="text-base font-semibold text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors line-clamp-2 focus-visible:outline-none focus-visible:underline"
          >
            {question.title}
          </Link>

          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
            {question.body}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {question.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-xs hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                {tag}
              </button>
            ))}

            <span className="flex items-center gap-1 text-xs text-neutral-500 ml-auto">
              <MessageSquare size={14} />
              {question.answerCount} {question.answerCount === 1 ? "answer" : "answers"}
            </span>

            <span className="text-xs text-neutral-500">
              {question.authorName} &middot; {timeAgo(question.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
