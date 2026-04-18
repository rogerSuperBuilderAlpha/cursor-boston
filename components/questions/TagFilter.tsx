/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { QUESTION_TAGS, type QuestionTag } from "@/types/questions";

const TAG_LABELS: Record<QuestionTag, string> = {
  "cursor-rules": "Cursor Rules",
  prompting: "Prompting",
  debugging: "Debugging",
  refactoring: "Refactoring",
  testing: "Testing",
  architecture: "Architecture",
  performance: "Performance",
  workflows: "Workflows",
  mcp: "MCP",
  agents: "Agents",
  other: "Other",
};

export function TagFilter({
  activeTag,
  onTagChange,
}: {
  activeTag: string;
  onTagChange: (tag: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onTagChange("")}
        className={[
          "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
          !activeTag
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700",
        ].join(" ")}
      >
        All
      </button>
      {QUESTION_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onTagChange(tag === activeTag ? "" : tag)}
          className={[
            "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
            tag === activeTag
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700",
          ].join(" ")}
        >
          {TAG_LABELS[tag]}
        </button>
      ))}
    </div>
  );
}
