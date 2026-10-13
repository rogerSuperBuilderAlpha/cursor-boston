/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LINK_FRAGMENT_COUNT,
  LINK_FRAGMENT_REFERRAL_BASE,
  listLinkFragmentPuzzles,
  type LinkFragmentPuzzle,
} from "@/lib/link-fragment-hunt";
import {
  LINK_FRAGMENT_UPDATED_EVENT,
  readStoredFragments,
  storedFragmentMap,
  writeStoredFragment,
  type StoredLinkFragment,
} from "@/components/hunt/link-fragment-storage";

export function LinkFragmentAssembler() {
  const puzzles = useMemo(() => listLinkFragmentPuzzles(), []);
  const [stored, setStored] = useState<Partial<Record<string, StoredLinkFragment>>>(
    () => storedFragmentMap()
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function syncStored() {
      setStored(storedFragmentMap());
    }
    window.addEventListener(LINK_FRAGMENT_UPDATED_EVENT, syncStored);
    return () => window.removeEventListener(LINK_FRAGMENT_UPDATED_EVENT, syncStored);
  }, []);

  const foundCount = puzzles.filter((p) => stored[p.id]).length;
  const allFound = foundCount >= LINK_FRAGMENT_COUNT;
  const maskedCode = puzzles
    .map((p) => stored[p.id]?.fragment ?? "??")
    .join("");

  useEffect(() => {
    if (!allFound) return;

    const tokens = Object.fromEntries(
      puzzles.map((p) => [p.id, stored[p.id]!.token])
    );

    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/hunt/link-fragment/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens }),
      });
      const j = (await res.json()) as { ok?: boolean; url?: string };
      if (!cancelled && j.ok && j.url) setFullUrl(j.url);
    })();

    return () => {
      cancelled = true;
    };
  }, [allFound, puzzles, stored]);

  const displayUrl = allFound ? fullUrl : null;

  async function submitPuzzle(puzzle: LinkFragmentPuzzle) {
    const answer = (answers[puzzle.id] || "").trim();
    if (!answer) return;

    setSubmitting(puzzle.id);
    setErrors((e) => ({ ...e, [puzzle.id]: "" }));
    try {
      const res = await fetch("/api/hunt/link-fragment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.id, answer }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        reason?: string;
        fragment?: string;
        token?: string;
        index?: number;
      };
      if (j.ok && j.token && j.fragment && typeof j.index === "number") {
        writeStoredFragment({
          puzzleId: puzzle.id,
          fragment: j.fragment,
          token: j.token,
          index: j.index,
        });
        setAnswers((a) => ({ ...a, [puzzle.id]: "" }));
        setStored(storedFragmentMap());
      } else {
        const msg =
          j.reason === "wrong_answer"
            ? "Not quite — keep exploring the site."
            : "Could not verify. Try again.";
        setErrors((e) => ({ ...e, [puzzle.id]: msg }));
      }
    } catch {
      setErrors((e) => ({ ...e, [puzzle.id]: "Network error." }));
    } finally {
      setSubmitting(null);
    }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
        <p className="text-sm text-zinc-400">
          You were given the start of a link. Six pairs of characters are hidden
          across cursorboston.com — solve each puzzle to reveal them.
        </p>
        <p className="mt-4 font-mono text-lg tracking-widest text-emerald-400 break-all">
          {LINK_FRAGMENT_REFERRAL_BASE}
          <span className="text-amber-300">{maskedCode}</span>
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          {foundCount} / {LINK_FRAGMENT_COUNT} fragments found
          {readStoredFragments().some((f) => f.puzzleId === "home-pulse")
            ? ""
            : " · one unlocks from an interaction on the home page"}
        </p>
        {displayUrl && (
          <div className="mt-5 rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-4">
            <p className="text-sm font-medium text-emerald-300">Full link</p>
            <p className="mt-2 font-mono text-sm text-emerald-100 break-all">{displayUrl}</p>
            <button
              type="button"
              onClick={() => void copyUrl(displayUrl)}
              className="mt-3 rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        )}
      </section>

      <div className="grid gap-4">
        {puzzles.map((puzzle) => {
          const found = stored[puzzle.id];
          return (
            <article
              key={puzzle.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
            >
              <h2 className="text-lg font-semibold">
                {puzzle.emoji} {puzzle.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">{puzzle.hint}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Clue lives on{" "}
                <code className="text-zinc-400">{puzzle.page}</code>
              </p>

              {found ? (
                <p className="mt-4 font-mono text-emerald-400">
                  Fragment {puzzle.index + 1}: {found.fragment}
                </p>
              ) : (
                <form
                  className="mt-4 flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitPuzzle(puzzle);
                  }}
                >
                  <input
                    type="text"
                    value={answers[puzzle.id] || ""}
                    onChange={(e) =>
                      setAnswers((a) => ({ ...a, [puzzle.id]: e.target.value }))
                    }
                    placeholder="Your answer"
                    className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="submit"
                    disabled={submitting === puzzle.id}
                    className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-amber-400 disabled:opacity-50"
                  >
                    {submitting === puzzle.id ? "Checking…" : "Submit"}
                  </button>
                  {errors[puzzle.id] && (
                    <p className="text-sm text-rose-400 sm:basis-full">{errors[puzzle.id]}</p>
                  )}
                </form>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
