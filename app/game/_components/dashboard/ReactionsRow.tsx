/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useState } from "react";
import type { User } from "firebase/auth";
import {
  REACTION_EMOJIS,
  type ReactionEmoji,
  type ReactionMap,
  type ReactionScope,
} from "@/lib/game/types";

interface Props {
  user: User | null;
  scope: ReactionScope;
  docId: string;
  /** Required when scope === "hero_event". Ignored for chat / feed. */
  heroId?: string;
  /** Initial counter map (from the server-rendered doc). */
  initialReactions?: ReactionMap;
  /** Set of "<scope>|<docId>|<emojiIndex>" strings the user has already
   *  placed. Used to highlight the buttons on initial render. */
  initialActive?: Set<string>;
  className?: string;
}

/**
 * Tiny inline button strip rendered under chat messages, feed events,
 * and hero events. Optimistic: counter bumps immediately on click,
 * rolls back on server error. The user-active state is tracked locally
 * so toggling is responsive without a server roundtrip.
 */
export function ReactionsRow({
  user,
  scope,
  docId,
  heroId,
  initialReactions,
  initialActive,
  className,
}: Props) {
  const [counts, setCounts] = useState<ReactionMap>(initialReactions ?? {});
  const [active, setActive] = useState<Set<ReactionEmoji>>(() => {
    const out = new Set<ReactionEmoji>();
    if (!initialActive) return out;
    for (let i = 0; i < REACTION_EMOJIS.length; i++) {
      const key = `${scope}|${docId}|${i}`;
      if (initialActive.has(key)) out.add(REACTION_EMOJIS[i]);
    }
    return out;
  });
  const [busy, setBusy] = useState<ReactionEmoji | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onToggle = useCallback(
    async (emoji: ReactionEmoji) => {
      if (!user || busy) return;
      setBusy(emoji);
      setError(null);
      const wasActive = active.has(emoji);

      // Optimistic update.
      setCounts((prev) => {
        const cur = prev[emoji] ?? 0;
        const next = { ...prev };
        const delta = wasActive ? -1 : 1;
        const after = cur + delta;
        if (after <= 0) delete next[emoji];
        else next[emoji] = after;
        return next;
      });
      setActive((prev) => {
        const next = new Set(prev);
        if (wasActive) next.delete(emoji);
        else next.add(emoji);
        return next;
      });

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/game/reactions", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            scope,
            docId,
            emoji,
            ...(heroId ? { heroId } : {}),
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Failed to toggle"
          );
        }
        // Reconcile with server truth (handles concurrent toggles).
        setCounts(data.reactions ?? {});
        setActive((prev) => {
          const next = new Set(prev);
          if (data.active) next.add(emoji);
          else next.delete(emoji);
          return next;
        });
      } catch (e) {
        // Roll back the optimistic update.
        setCounts((prev) => {
          const cur = prev[emoji] ?? 0;
          const next = { ...prev };
          const delta = wasActive ? 1 : -1;
          const after = cur + delta;
          if (after <= 0) delete next[emoji];
          else next[emoji] = after;
          return next;
        });
        setActive((prev) => {
          const next = new Set(prev);
          if (wasActive) next.add(emoji);
          else next.delete(emoji);
          return next;
        });
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setBusy(null);
      }
    },
    [user, busy, active, scope, docId, heroId]
  );

  if (!user) return null;

  return (
    <div
      className={`mt-1 flex items-center gap-1 ${className ?? ""}`}
      role="group"
      aria-label="React"
    >
      {REACTION_EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        const isActive = active.has(emoji);
        return (
          <button
            key={emoji}
            type="button"
            disabled={busy === emoji}
            onClick={() => onToggle(emoji)}
            aria-pressed={isActive}
            className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isActive
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600"
            }`}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 && <span className="font-mono">{count}</span>}
          </button>
        );
      })}
      {error && (
        <span className="ml-1 text-[10px] text-red-500" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
