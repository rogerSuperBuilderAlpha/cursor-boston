/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Sword,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type {
  Caste,
  CommunityEvent,
  CommunityMessage,
} from "@/lib/game/types";

const CASTE_SWATCH: Record<Caste, string> = {
  white: "#e5e7eb",
  blue: "#60a5fa",
  black: "#a78bfa",
  red: "#f87171",
  green: "#4ade80",
};

const MAX_BODY = 500;

interface Props {
  user: User | null;
  isAdmin: boolean;
}

/**
 * Collapsible community panel mounted at the bottom of the dashboard.
 * Default-collapsed so it doesn't compete with the action surface for
 * attention; expand on click. When expanded:
 *   - Left: most recent 50 community events (player joins, caste picks,
 *     attacks, 1k-tile milestones).
 *   - Right: most recent 50 chat messages with a post-message input.
 *
 * No real-time listeners — refresh button + auto-fetch on first
 * expansion. Cheaper and more predictable than push.
 */
export function CommunityPanel({ user, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [feedRes, chatRes] = await Promise.all([
        fetch("/api/game/community/feed", { headers }),
        fetch("/api/game/community/chat", { headers }),
      ]);
      const feedData = await feedRes.json();
      const chatData = await chatRes.json();
      if (feedData.success) setEvents(feedData.events ?? []);
      if (chatData.success) setMessages(chatData.messages ?? []);
      if (!feedData.success || !chatData.success) {
        setError(
          feedData.error?.message ??
            chatData.error?.message ??
            "Failed to load"
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Lazy-load on first expansion. The refresh() call sets state via
  // setEvents/setMessages which the lint rule flags conservatively —
  // suppressed because that's the canonical "kick off async fetch on
  // open" pattern.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (open && events.length === 0 && messages.length === 0 && !loading) {
      void refresh();
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  async function postMessage() {
    if (!user) return;
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    setPosting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/community/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: trimmed }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(
          data.error?.message ?? data.error ?? "Failed to post"
        );
      }
      setDraft("");
      // Optimistic prepend; refresh on next manual hit.
      setMessages((prev) => [data.message as CommunityMessage, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  async function deleteMessage(messageId: string) {
    if (!user) return;
    if (!confirm("Delete this message?")) return;
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/game/community/chat/${messageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(
          data.error?.message ?? data.error ?? "Failed to delete"
        );
      }
      // Drop locally without a refetch.
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <section className="mb-8 rounded-lg border border-neutral-200 dark:border-neutral-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {open ? (
            <ChevronDown
              className="h-4 w-4"
              strokeWidth={2.25}
              aria-hidden="true"
            />
          ) : (
            <ChevronRight
              className="h-4 w-4"
              strokeWidth={2.25}
              aria-hidden="true"
            />
          )}
          Community — recent events &amp; chat
        </span>
        <span className="text-xs text-neutral-500">
          {open ? "click to collapse" : "click to expand"}
        </span>
      </button>

      {open && (
        <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              {events.length} event{events.length === 1 ? "" : "s"} ·{" "}
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </p>
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                strokeWidth={2.25}
                aria-hidden="true"
              />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {error && (
            <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/10 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <ActivityFeed events={events} />
            <ChatBoard
              messages={messages}
              draft={draft}
              setDraft={setDraft}
              posting={posting}
              onPost={() => void postMessage()}
              onDelete={(id) => void deleteMessage(id)}
              currentUserId={user?.uid ?? null}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Activity feed (left column)
// ---------------------------------------------------------------------------

function ActivityFeed({ events }: { events: CommunityEvent[] }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Sparkles
          className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
          strokeWidth={2.25}
          aria-hidden="true"
        />
        Recent events
      </h3>
      {events.length === 0 ? (
        <p className="text-sm text-neutral-500 italic">
          No events yet. Be the first to attack a neighbor.
        </p>
      ) : (
        <ul className="max-h-[400px] space-y-1.5 overflow-y-auto pr-1 text-sm">
          {events.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EventRow({ event }: { event: CommunityEvent }) {
  const at = parseTimestamp(event.createdAt);
  const swatch = event.actorCaste
    ? CASTE_SWATCH[event.actorCaste]
    : "#737373";
  return (
    <li className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-950">
      <span
        className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: swatch }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] leading-snug">
          <EventBody event={event} />
        </p>
        <p className="text-[10px] text-neutral-500">
          {at ? at.toLocaleString() : ""}
        </p>
      </div>
      <EventIcon kind={event.kind} />
    </li>
  );
}

function EventBody({ event }: { event: CommunityEvent }) {
  const actor = (
    <strong className="capitalize">{event.actorDisplayName}</strong>
  );
  switch (event.kind) {
    case "player_join":
      return <>{actor} joined the world.</>;
    case "caste_pick":
      return (
        <>
          {actor} chose <strong className="capitalize">{event.actorCaste}</strong>.
        </>
      );
    case "caste_change":
      return (
        <>
          {actor} switched from{" "}
          <strong className="capitalize">{event.fromCaste}</strong> to{" "}
          <strong className="capitalize">{event.toCaste}</strong> (final).
        </>
      );
    case "attack": {
      const target = (
        <strong className="capitalize">{event.targetDisplayName}</strong>
      );
      const tile = event.tileId ? (
        <span className="font-mono text-[11px]">{event.tileId}</span>
      ) : null;
      if (event.outcome === "captured") {
        return (
          <>
            {actor} captured {tile} from {target}.
          </>
        );
      }
      if (event.outcome === "repelled") {
        return (
          <>
            {actor} attacked {target} at {tile} — repelled.
          </>
        );
      }
      return (
        <>
          {actor} attacked {target} at {tile} — stalemate.
        </>
      );
    }
    case "milestone_1k_tiles":
      return <>{actor} crossed 1,000 tiles. Caste switch unlocked.</>;
    default:
      return <>{actor} did something.</>;
  }
}

function EventIcon({
  kind,
}: {
  kind: CommunityEvent["kind"];
}) {
  const cls = "h-3.5 w-3.5 text-neutral-500 mt-0.5 shrink-0";
  if (kind === "player_join") {
    return <UserPlus className={cls} strokeWidth={2.25} aria-hidden="true" />;
  }
  if (kind === "attack") {
    return <Sword className={cls} strokeWidth={2.25} aria-hidden="true" />;
  }
  if (kind === "milestone_1k_tiles") {
    return (
      <Sparkles
        className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0"
        strokeWidth={2.25}
        aria-hidden="true"
      />
    );
  }
  return <Sparkles className={cls} strokeWidth={2.25} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Chat board (right column)
// ---------------------------------------------------------------------------

interface ChatBoardProps {
  messages: CommunityMessage[];
  draft: string;
  setDraft: (s: string) => void;
  posting: boolean;
  onPost: () => void;
  onDelete: (id: string) => void;
  currentUserId: string | null;
  isAdmin: boolean;
}

function ChatBoard({
  messages,
  draft,
  setDraft,
  posting,
  onPost,
  onDelete,
  currentUserId,
  isAdmin,
}: ChatBoardProps) {
  const remaining = MAX_BODY - draft.length;
  return (
    <div className="flex min-h-0 flex-col">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <MessageSquare
          className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
          strokeWidth={2.25}
          aria-hidden="true"
        />
        Chat
      </h3>
      {messages.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-500 italic">
          No messages yet. Say hi.
        </p>
      ) : (
        <ul className="mb-3 max-h-[340px] space-y-1.5 overflow-y-auto pr-1 text-sm">
          {messages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              canDelete={
                currentUserId === m.userId || isAdmin
              }
              onDelete={() => onDelete(m.id)}
            />
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_BODY))}
          placeholder="Say something to the kingdom…"
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
          maxLength={MAX_BODY}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onPost();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span
            className={`text-[11px] ${
              remaining < 50
                ? "text-amber-600"
                : "text-neutral-500"
            }`}
          >
            {remaining} chars left · ⌘/Ctrl + Enter to send
          </span>
          <button
            onClick={onPost}
            disabled={posting || draft.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send
              className="h-3.5 w-3.5"
              strokeWidth={2.25}
              aria-hidden="true"
            />
            {posting ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  canDelete,
  onDelete,
}: {
  message: CommunityMessage;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const at = parseTimestamp(message.createdAt);
  const swatch = message.caste ? CASTE_SWATCH[message.caste] : "#737373";
  return (
    <li className="group flex items-start gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-950">
      <span
        className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: swatch }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] leading-snug">
          <strong className="capitalize">{message.displayName}</strong>{" "}
          <span className="text-[10px] text-neutral-500">
            {at ? at.toLocaleString() : ""}
          </span>
        </p>
        <p className="whitespace-pre-wrap break-words text-[12.5px] leading-snug text-neutral-700 dark:text-neutral-200">
          {message.body}
        </p>
      </div>
      {canDelete && (
        <button
          onClick={onDelete}
          className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Delete message"
          title="Delete"
        >
          <Trash2
            className="h-3.5 w-3.5 text-neutral-500 hover:text-red-500"
            strokeWidth={2.25}
            aria-hidden="true"
          />
        </button>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FirestoreTimestampLike {
  _seconds?: number;
  seconds?: number;
}

function parseTimestamp(t: unknown): Date | null {
  if (!t) return null;
  if (t instanceof Date) return t;
  if (typeof t === "string") return new Date(t);
  if (typeof t === "object") {
    const ts = t as FirestoreTimestampLike;
    if (typeof ts._seconds === "number") return new Date(ts._seconds * 1000);
    if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  }
  return null;
}
