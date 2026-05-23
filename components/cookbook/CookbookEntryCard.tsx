/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/cookbook-labels";
import { formatCookbookDate } from "@/lib/format-cookbook-date";
import { CLASS_GROUPS, TAILWIND_CLASS_NAMES as TW } from "@/lib/classname-constants";
import { cn } from "@/lib/utils";
import type { CookbookCategory, CookbookEntry } from "@/types/cookbook";
import { PromptMarkdown } from "./PromptMarkdown";

/** Displays a single cookbook entry with prompt preview, metadata, tags, and voting controls. */
export function CookbookEntryCard({
  entry,
  votes,
  userVote,
  isLoggedIn,
  isVoting,
  onVote,
  onViewFull,
  onTagClick,
}: {
  entry: CookbookEntry;
  votes?: { upCount: number; downCount: number };
  userVote?: string;
  isLoggedIn: boolean;
  isVoting: boolean;
  onVote: (entryId: string, type: "up" | "down") => void;
  onViewFull: (entry: CookbookEntry) => void;
  onTagClick?: (tag: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const upCount = votes?.upCount || 0;
  const downCount = votes?.downCount || 0;
  const netScore = upCount - downCount;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entry.promptContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.warn("Cookbook: clipboard copy failed");
    }
  };

  const previewLength = 600;
  const preview = entry.promptContent.slice(0, previewLength);
  const hasMore = entry.promptContent.length > previewLength;

  const MAX_WORKS_WITH = 4;
  const MAX_TAGS = 3;
  const worksWithList = entry.worksWith ?? [];
  const tagsList = entry.tags ?? [];
  const worksWithDisplay = worksWithList.slice(0, MAX_WORKS_WITH);
  const worksWithMore = worksWithList.length - MAX_WORKS_WITH;
  const tagsDisplay = tagsList.slice(0, MAX_TAGS);
  const tagsMore = tagsList.length - MAX_TAGS;

  return (
    <div className={cn("group hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:shadow-lg dark:hover:shadow-emerald-500/5", TW.layout.hFull, TW.layout.flex, TW.layout.flexCol, TW.radius.twoXl, TW.layout.overflowHidden, TW.surface.card, TW.border.neutral, TW.motion.all, TW.motion.duration200)}>
      <div className="p-6 flex flex-col flex-1 min-h-0">
        <h3 className="text-lg font-bold text-foreground mb-2">{entry.title}</h3>
        <p className={cn(CLASS_GROUPS.text.muted, "leading-relaxed", TW.spacing.mb4, "line-clamp-2")}>
          {entry.description}
        </p>

        <div className="relative rounded-xl overflow-hidden mb-4 border border-neutral-200 dark:border-neutral-700/80 bg-neutral-50 dark:bg-neutral-950 shadow-inner">
          <div className="flex items-center justify-between px-3 py-2 bg-neutral-100 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700/80">
            <span className={cn(TW.text.tiny, TW.text.medium, TW.text.subtle, TW.text.uppercase, TW.text.wide)}>
              Prompt
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewFull(entry);
                }}
                aria-label={`View full prompt: ${entry.title}`}
                className={cn(TW.text.tiny, TW.text.medium, TW.text.accent, "hover:text-emerald-500 dark:hover:text-emerald-300", TW.motion.colors)}
              >
                View full
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleCopy();
                }}
                aria-label={copied ? "Prompt copied to clipboard" : `Copy prompt: ${entry.title}`}
                className={cn(TW.spacing.px2, TW.spacing.py1, TW.radius.md, "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600", TW.text.tiny, TW.text.medium, TW.motion.colors, TW.focus.emerald)}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
          <PromptMarkdown
            content={`${preview}${hasMore ? "\n\n…" : ""}`}
            className="h-32 overflow-y-auto overflow-x-hidden px-3 py-2 text-sm [&>*:last-child]:mb-0"
          />
        </div>

        <div className="flex-1 flex flex-col justify-start gap-3 mb-4">
          <div>
            <span className={CLASS_GROUPS.tag.successPill}>
              {CATEGORY_LABELS[entry.category as CookbookCategory] || entry.category}
            </span>
          </div>
          {worksWithList.length > 0 && (
            <div>
              <span className={cn(TW.layout.block, TW.text.tiny, TW.text.medium, TW.text.subtle, TW.spacing.mb2, TW.text.uppercase, TW.text.wide)}>
                Works with
              </span>
              <div className="flex flex-wrap gap-1.5">
                {worksWithDisplay.map((w) => (
                  <span
                    key={w}
                    className={CLASS_GROUPS.tag.neutralStrongPill}
                  >
                    {w}
                  </span>
                ))}
                {worksWithMore > 0 && (
                  <span className="px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-xs font-medium rounded-full">
                    +{worksWithMore}
                  </span>
                )}
              </div>
            </div>
          )}
          {tagsList.length > 0 && (
            <div>
              <span className={cn(TW.layout.block, TW.text.tiny, TW.text.medium, TW.text.subtle, TW.spacing.mb2, TW.text.uppercase, TW.text.wide)}>
                Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tagsDisplay.map((tag) =>
                  onTagClick ? (
                    <button
                      key={tag}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTagClick(tag);
                      }}
                      aria-label={`Filter by tag: ${tag}`}
                      className={cn(CLASS_GROUPS.tag.neutralPill, "hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-neutral-800 dark:hover:text-neutral-200", TW.motion.colors, TW.focus.emerald)}
                    >
                      {tag}
                    </button>
                  ) : (
                    <span
                      key={tag}
                      className={CLASS_GROUPS.tag.neutralPill}
                    >
                      {tag}
                    </span>
                  )
                )}
                {tagsMore > 0 && (
                  <span className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-xs font-medium rounded-full">
                    +{tagsMore}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Link
              href={`/members?search=${encodeURIComponent(entry.authorDisplayName)}`}
              className={cn(CLASS_GROUPS.text.metadata, "hover:text-foreground", TW.motion.colors)}
            >
              by {entry.authorDisplayName}
            </Link>
            {entry.createdAt && (
              <span className={cn(CLASS_GROUPS.text.metadata, TW.layout.block, "mt-0.5")}>
                {formatCookbookDate(entry.createdAt)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onVote(entry.id, "up")}
              disabled={!isLoggedIn || isVoting}
              title={isLoggedIn ? "Upvote" : "Sign in to vote"}
              aria-label={`Upvote ${entry.title}, ${upCount} upvotes`}
              className={cn(
                TW.layout.flex,
                TW.layout.itemsCenter,
                TW.spacing.gap1,
                TW.spacing.px2,
                TW.spacing.py1,
                TW.radius.lg,
                TW.text.sm,
                TW.motion.colors,
                userVote === "up"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                TW.state.disabledSoft
              )}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 10v12" />
                <path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88z" />
              </svg>
              <span>{upCount}</span>
            </button>

            <span
              className={cn(
                TW.text.sm,
                TW.text.semibold,
                "min-w-8 text-center",
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
              onClick={() => onVote(entry.id, "down")}
              disabled={!isLoggedIn || isVoting}
              title={isLoggedIn ? "Downvote" : "Sign in to vote"}
              aria-label={`Downvote ${entry.title}, ${downCount} downvotes`}
              className={cn(
                TW.layout.flex,
                TW.layout.itemsCenter,
                TW.spacing.gap1,
                TW.spacing.px2,
                TW.spacing.py1,
                TW.radius.lg,
                TW.text.sm,
                TW.motion.colors,
                userVote === "down"
                  ? "bg-red-500/10 text-red-500"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                TW.state.disabledSoft
              )}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 14V2" />
                <path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88z" />
              </svg>
              <span>{downCount}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
