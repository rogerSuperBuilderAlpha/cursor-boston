/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export function KonamiListener() {
  const { user } = useAuth();
  const [revealed, setRevealed] = useState<null | { token?: string; error?: string }>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | string>(null);

  useEffect(() => {
    let index = 0;
    function onKey(e: KeyboardEvent) {
      const expected = SEQUENCE[index];
      if (e.key.toLowerCase() === expected?.toLowerCase()) {
        index += 1;
        if (index === SEQUENCE.length) {
          index = 0;
          void fetch("/api/hunt/oracle/konami", {
            headers: { "X-Konami-Sequence": "UUDDLRLRBA" },
          })
            .then(async (r) => {
              if (!r.ok) {
                setRevealed({ error: "Not today." });
                return;
              }
              const j = (await r.json()) as { token?: string };
              if (j.token) setRevealed({ token: j.token });
            })
            .catch(() => setRevealed({ error: "Network error." }));
        }
      } else {
        index = 0;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submit() {
    if (!user || !revealed?.token) return;
    setSubmitting(true);
    setResult(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/hunt/paths/konami/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answer: revealed.token }),
      });
      const j = (await res.json()) as { ok?: boolean; reason?: string; message?: string };
      if (j.ok) {
        setResult(j.message || "Claimed. Check your email.");
      } else {
        setResult(`Failed: ${j.reason || "unknown"}`);
      }
    } catch {
      setResult("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!revealed) return null;

  return (
    <div
      role="dialog"
      aria-label="Konami path"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-amber-500/50 bg-zinc-900/95 p-4 text-sm text-zinc-100 shadow-xl backdrop-blur"
    >
      {revealed.error && <p>{revealed.error}</p>}
      {revealed.token && (
        <>
          <p className="font-semibold">🎮 You found a path.</p>
          <p className="mt-1 font-mono text-xs text-amber-300">
            token: {revealed.token}
          </p>
          {!user && (
            <p className="mt-2 text-xs text-zinc-400">
              Sign in and connect GitHub + Discord to claim.
            </p>
          )}
          {user && (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="mt-2 rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-zinc-900 hover:bg-amber-400 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Claim prize"}
            </button>
          )}
          {result && <p className="mt-2 text-xs">{result}</p>}
        </>
      )}
      <button
        type="button"
        onClick={() => setRevealed(null)}
        className="absolute right-1 top-1 text-xs text-zinc-500 hover:text-zinc-300"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}
