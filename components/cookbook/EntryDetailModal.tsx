"use client";

import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/cookbook-labels";
import { formatCookbookDate } from "@/lib/format-cookbook-date";
import type { CookbookCategory, CookbookEntry } from "@/types/cookbook";
import { PromptMarkdown } from "./PromptMarkdown";

export function EntryDetailModal({
  entry,
  votes,
  userVote,
  isLoggedIn,
  isVoting,
  onVote,
  onClose,
}: {
  entry: CookbookEntry;
  votes?: { upCount: number; downCount: number };
  userVote?: string;
  isLoggedIn: boolean;
  isVoting: boolean;
  onVote: (entryId: string, type: "up" | "down") => void;
  onClose: () => void;
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

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e: ReactKeyboardEvent) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const modal = e.currentTarget.querySelector("[data-modal-content]");
          if (!modal) return;
          const focusable = modal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <div
        data-modal-content
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="shrink-0 px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2
              id="entry-modal-title"
              className="text-xl font-bold text-foreground mb-1"
            >
              {entry.title}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
              {entry.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg text-neutral-500 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6 space-y-4">
            <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950">
              <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Full prompt
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <PromptMarkdown
                content={entry.promptContent}
                className="max-h-[40vh] overflow-y-auto overflow-x-hidden px-4 py-3 text-sm [&>*:last-child]:mb-0"
              />
            </div>

            <div className="space-y-3">
              <div>
                <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                  Category
                </span>
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-full">
                  {CATEGORY_LABELS[entry.category as CookbookCategory] || entry.category}
                </span>
              </div>
              {(entry.worksWith ?? []).length > 0 && (
                <div>
                  <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                    Works with
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(entry.worksWith ?? []).map((w) => (
                      <span
                        key={w}
                        className="px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium rounded-full"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(entry.tags ?? []).length > 0 && (
                <div>
                  <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(entry.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-medium rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950/50">
          <div>
            <Link
              href={`/members?search=${encodeURIComponent(entry.authorDisplayName)}`}
              className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
            >
              by {entry.authorDisplayName}
            </Link>
            {entry.createdAt && (
              <span className="block text-xs text-neutral-500 mt-0.5">
                {formatCookbookDate(entry.createdAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onVote(entry.id, "up")}
              disabled={!isLoggedIn || isVoting}
              title={isLoggedIn ? "Upvote" : "Sign in to vote"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                userVote === "up"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 10v12" />
                <path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88z" />
              </svg>
              {upCount}
            </button>
            <span
              className={`text-sm font-semibold min-w-6 text-center ${
                netScore > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : netScore < 0
                    ? "text-red-500"
                    : "text-neutral-500"
              }`}
            >
              {netScore > 0 ? `+${netScore}` : netScore}
            </span>
            <button
              type="button"
              onClick={() => onVote(entry.id, "down")}
              disabled={!isLoggedIn || isVoting}
              title={isLoggedIn ? "Downvote" : "Sign in to vote"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                userVote === "down"
                  ? "bg-red-500/10 text-red-500"
                  : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 14V2" />
                <path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88z" />
              </svg>
              {downCount}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
