/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";

interface Chapter {
  id: string;
  authorId: string;
  authorDisplayName: string;
  body: string;
  status: "pending" | "approved";
  createdAt: string | { seconds: number };
}

interface Epitaph {
  id: string;
  authorId: string;
  authorDisplayName: string;
  body: string;
  createdAt: string | { seconds: number };
}

interface Props {
  user: User | null;
  heroId: string;
  isFallen: boolean;
  isAdmin: boolean;
}

const MAX_CHAPTER = 2000;
const MAX_EPITAPH = 280;

function formatAt(at: string | { seconds: number } | undefined): string {
  if (!at) return "";
  if (typeof at === "string") {
    const d = new Date(at);
    return isNaN(d.valueOf()) ? "" : d.toLocaleString();
  }
  return new Date(at.seconds * 1000).toLocaleString();
}

export function HeroLoreSection({ user, heroId, isFallen, isAdmin }: Props) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [epitaphs, setEpitaphs] = useState<Epitaph[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [chRes, epRes] = await Promise.all([
        fetch(`/api/game/heroes/${heroId}/chapter`, { headers }),
        isFallen
          ? fetch(`/api/game/heroes/${heroId}/epitaph`, { headers })
          : Promise.resolve(null),
      ]);
      const chData = await chRes.json();
      if (chData.success) setChapters(chData.chapters ?? []);
      if (epRes) {
        const epData = await epRes.json();
        if (epData.success) setEpitaphs(epData.epitaphs ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lore");
    }
  }, [user, heroId, isFallen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return (
    <>
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">In-game chapters</h2>
        {error && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {chapters.length === 0 ? (
          <p className="text-sm text-neutral-500 italic mb-3">
            No in-game chapters yet.
          </p>
        ) : (
          <ul className="space-y-3 mb-3">
            {chapters.map((c) => (
              <ChapterRow
                key={c.id}
                chapter={c}
                user={user}
                heroId={heroId}
                isAdmin={isAdmin}
                onChange={refresh}
              />
            ))}
          </ul>
        )}
        <ChapterForm
          user={user}
          heroId={heroId}
          onPosted={refresh}
        />
      </section>

      {isFallen && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Epitaphs</h2>
          {epitaphs.length === 0 ? (
            <p className="text-sm text-neutral-500 italic mb-3">
              No epitaphs yet — be the first to remember them.
            </p>
          ) : (
            <ul className="space-y-2 mb-3">
              {epitaphs.map((e) => (
                <EpitaphRow
                  key={e.id}
                  epitaph={e}
                  user={user}
                  heroId={heroId}
                  isAdmin={isAdmin}
                  onChange={refresh}
                />
              ))}
            </ul>
          )}
          <EpitaphForm
            user={user}
            heroId={heroId}
            onPosted={refresh}
          />
        </section>
      )}
    </>
  );
}

function ChapterRow({
  chapter,
  user,
  heroId,
  isAdmin,
  onChange,
}: {
  chapter: Chapter;
  user: User | null;
  heroId: string;
  isAdmin: boolean;
  onChange: () => void;
}) {
  const canDelete = user?.uid === chapter.authorId || isAdmin;
  const canApprove = isAdmin && chapter.status === "pending";

  const onDelete = useCallback(async () => {
    if (!user) return;
    if (!confirm("Delete this chapter?")) return;
    const token = await user.getIdToken();
    await fetch(`/api/game/heroes/${heroId}/chapter/${chapter.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    onChange();
  }, [user, heroId, chapter.id, onChange]);

  const onApprove = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch(`/api/game/heroes/${heroId}/chapter/${chapter.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    onChange();
  }, [user, heroId, chapter.id, onChange]);

  return (
    <li className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-900/5 p-4">
      <div className="flex items-center justify-between mb-2 text-xs text-neutral-500">
        <span>
          <strong className="capitalize text-neutral-700 dark:text-neutral-300">
            {chapter.authorDisplayName}
          </strong>{" "}
          · {formatAt(chapter.createdAt)}
          {chapter.status === "pending" && (
            <span className="ml-2 inline-block rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
              pending
            </span>
          )}
        </span>
        <span className="flex gap-2">
          {canApprove && (
            <button
              type="button"
              onClick={onApprove}
              className="text-emerald-600 hover:text-emerald-500"
            >
              Approve
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-red-500 hover:text-red-400"
            >
              Delete
            </button>
          )}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {chapter.body}
      </p>
    </li>
  );
}

function ChapterForm({
  user,
  heroId,
  onPosted,
}: {
  user: User | null;
  heroId: string;
  onPosted: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!user) return;
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/game/heroes/${heroId}/chapter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to post"
        );
      }
      setDraft("");
      onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }, [user, draft, heroId, onPosted]);

  if (!user) return null;
  const remaining = MAX_CHAPTER - draft.length;
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHAPTER))}
        rows={5}
        placeholder="Add a new chapter to this hero's chronicle…"
        className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
        maxLength={MAX_CHAPTER}
      />
      <div className="mt-2 flex items-center justify-between">
        <span
          className={`text-[11px] ${
            remaining < 100 ? "text-amber-600" : "text-neutral-500"
          }`}
        >
          {remaining} chars left · auto-publishes if you own this hero,
          else pending admin approval
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={posting || draft.trim().length === 0}
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {posting ? "Posting…" : "Submit chapter"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function EpitaphRow({
  epitaph,
  user,
  heroId,
  isAdmin,
  onChange,
}: {
  epitaph: Epitaph;
  user: User | null;
  heroId: string;
  isAdmin: boolean;
  onChange: () => void;
}) {
  const canDelete = user?.uid === epitaph.authorId || isAdmin;
  const onDelete = useCallback(async () => {
    if (!user) return;
    if (!confirm("Delete this epitaph?")) return;
    const token = await user.getIdToken();
    await fetch(`/api/game/heroes/${heroId}/epitaph/${epitaph.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    onChange();
  }, [user, heroId, epitaph.id, onChange]);

  return (
    <li className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm">
      <p className="italic">&ldquo;{epitaph.body}&rdquo;</p>
      <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-500">
        <span>
          — <strong className="capitalize">{epitaph.authorDisplayName}</strong>{" "}
          · {formatAt(epitaph.createdAt)}
        </span>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-red-500 hover:text-red-400"
          >
            Delete
          </button>
        )}
      </div>
    </li>
  );
}

function EpitaphForm({
  user,
  heroId,
  onPosted,
}: {
  user: User | null;
  heroId: string;
  onPosted: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!user) return;
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/game/heroes/${heroId}/epitaph`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to post"
        );
      }
      setDraft("");
      onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }, [user, draft, heroId, onPosted]);

  if (!user) return null;
  const remaining = MAX_EPITAPH - draft.length;
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, MAX_EPITAPH))}
        rows={2}
        placeholder="Write a short epitaph…"
        className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
        maxLength={MAX_EPITAPH}
      />
      <div className="mt-2 flex items-center justify-between">
        <span
          className={`text-[11px] ${
            remaining < 40 ? "text-amber-600" : "text-neutral-500"
          }`}
        >
          {remaining} chars left
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={posting || draft.trim().length === 0}
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {posting ? "Posting…" : "Submit epitaph"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
