/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function HuntClaimForm({
  pathId,
  initialAnswer = "",
}: {
  pathId: string;
  initialAnswer?: string;
}) {
  const { user } = useAuth();
  const [answer, setAnswer] = useState(initialAnswer);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | {
    ok: boolean;
    message: string;
  }>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setResult({ ok: false, message: "Sign in first." });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/hunt/paths/${pathId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answer }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        reason?: string;
        message?: string;
      };
      if (j.ok) {
        setResult({
          ok: true,
          message: j.message || "Claimed. Check your email for the credit link.",
        });
      } else {
        const reasonMap: Record<string, string> = {
          wrong_answer: "That's not it. Try again.",
          not_signed_in: "Sign in first.",
          no_github: "Link your GitHub on your profile.",
          no_discord: "Link your Discord on your profile.",
          no_recent_pr:
            "You need a PR merged into the main repo in the last 24 hours.",
          already_won: "You've already claimed a prize.",
          email_already_won: "Your email has already won.",
          path_taken: "Someone else cracked this path first.",
          pool_empty: "All prizes have been claimed.",
          rate_limited: "Too many wrong answers. Try again in an hour.",
          feature_disabled: "The hunt is paused.",
        };
        setResult({
          ok: false,
          message: reasonMap[j.reason || ""] || `Failed: ${j.reason || "unknown"}`,
        });
      }
    } catch {
      setResult({ ok: false, message: "Network error." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">
        Your answer
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </label>
      <button
        type="submit"
        disabled={submitting || !user}
        className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-amber-400 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : user ? "Submit" : "Sign in to submit"}
      </button>
      {result && (
        <p
          className={`text-sm ${result.ok ? "text-emerald-400" : "text-rose-400"}`}
          role="status"
        >
          {result.message}
        </p>
      )}
    </form>
  );
}
