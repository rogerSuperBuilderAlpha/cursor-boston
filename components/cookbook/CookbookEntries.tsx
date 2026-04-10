/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { CookbookEntry } from "@/types/cookbook";
import { CookbookEntryCard } from "./CookbookEntryCard";

/** Renders a responsive grid of cookbook entry cards with vote and tag interaction. */
export function CookbookEntries({
  entries,
  voteState,
  isLoggedIn,
  votingId,
  onVote,
  onViewFull,
  onTagClick,
}: {
  entries: CookbookEntry[];
  voteState: Record<string, { upCount: number; downCount: number; userVote?: "up" | "down" }>;
  isLoggedIn: boolean;
  votingId: string | null;
  onVote: (entryId: string, type: "up" | "down") => void;
  onViewFull: (entry: CookbookEntry) => void;
  onTagClick?: (tag: string) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-6">
      {entries.map((entry) => {
        const v = voteState[entry.id];
        return (
          <CookbookEntryCard
            key={entry.id}
            entry={entry}
            votes={v ? { upCount: v.upCount, downCount: v.downCount } : undefined}
            userVote={v?.userVote}
            isLoggedIn={isLoggedIn}
            isVoting={votingId === entry.id}
            onVote={onVote}
            onViewFull={onViewFull}
            onTagClick={onTagClick}
          />
        );
      })}
    </div>
  );
}
