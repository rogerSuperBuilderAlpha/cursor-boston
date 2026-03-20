"use client";

import type { CookbookEntry } from "@/types/cookbook";
import { CookbookEntryCard } from "./CookbookEntryCard";

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
