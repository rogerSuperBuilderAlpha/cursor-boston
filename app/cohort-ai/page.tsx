/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Turn {
  role: "user" | "assistant";
  text: string;
  credits?: { chargedCostCents?: number; newBalance?: number };
}

const MODEL_ID = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;
const TOPUP_URL = "https://pitchrise.ludwitt.com/account/credits";

function ConnectCta() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-lg font-semibold">Sign in with Ludwitt to use this</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        The cohort assistant runs on your Ludwitt credits. Sign in once and
        you&apos;re set.
      </p>
      <a
        href={`/api/ludwitt/authorize?returnTo=${encodeURIComponent("/cohort-ai")}`}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Sign in with Ludwitt
      </a>
    </div>
  );
}

function CreditsFooter({ credits }: { credits?: Turn["credits"] }) {
  if (!credits) return null;
  const cost =
    typeof credits.chargedCostCents === "number"
      ? `$${(credits.chargedCostCents / 100).toFixed(4)}`
      : "—";
  const balance =
    typeof credits.newBalance === "number"
      ? `$${(credits.newBalance / 100).toFixed(2)}`
      : "—";
  return (
    <div className="mt-1 text-xs text-neutral-500">
      cost: {cost} · balance: {balance}
    </div>
  );
}

export default function CohortAiPage() {
  const { user, userProfile, loading } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const text = prompt.trim();
    if (!text) return;

    const next: Turn[] = [...turns, { role: "user", text }];
    setTurns(next);
    setPrompt("");
    setError(null);
    setOutOfCredits(false);
    setSubmitting(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/ludwitt/ai/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: MODEL_ID,
          max_tokens: MAX_TOKENS,
          messages: next.map((t) => ({ role: t.role, content: t.text })),
        }),
      });

      if (res.status === 402) {
        setOutOfCredits(true);
        return;
      }
      if (res.status === 412) {
        window.location.href = `/api/ludwitt/authorize?returnTo=${encodeURIComponent("/cohort-ai")}`;
        return;
      }
      if (res.status === 401) {
        setError("Your Ludwitt session expired. Please sign in again.");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(`Error ${res.status}: ${(j as { error?: string }).error ?? "request_failed"}`);
        return;
      }

      const data = (await res.json()) as {
        content?: Array<{ type?: string; text?: string }>;
      };
      const assistantText =
        data.content?.find((c) => c.type === "text")?.text ?? "(no content)";

      let credits: Turn["credits"] | undefined;
      const creditsHeader = res.headers.get("x-ludwitt-credits");
      if (creditsHeader) {
        try {
          credits = JSON.parse(creditsHeader);
        } catch {
          // ignore parse failures
        }
      }

      setTurns([...next, { role: "assistant", text: assistantText, credits }]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:py-14">
        <header className="mb-6">
          <h1 className="text-3xl font-bold md:text-4xl">Cohort assistant</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            An AI assistant for cohort members, powered by your Ludwitt credits.
          </p>
        </header>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm">
            Please{" "}
            <Link href="/login?redirect=/cohort-ai" className="underline">
              sign in
            </Link>{" "}
            to continue.
          </p>
        </div>
      </div>
    );
  }

  const ludwittConnected = Boolean(userProfile?.ludwitt?.sub);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6 md:py-14">
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
          Cohort assistant
        </div>
        <h1 className="mt-3 text-3xl font-bold md:text-4xl">
          Ask the cohort assistant
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Powered by your Ludwitt credits. Each call deducts based on actual
          token usage.
        </p>
      </header>

      {!ludwittConnected ? (
        <ConnectCta />
      ) : (
        <>
          {turns.length > 0 ? (
            <div className="mb-6 space-y-4">
              {turns.map((t, i) => (
                <div
                  key={i}
                  className={
                    t.role === "user"
                      ? "rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
                      : "rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30"
                  }
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {t.role}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap text-sm">{t.text}</div>
                  <CreditsFooter credits={t.credits} />
                </div>
              ))}
            </div>
          ) : null}

          {outOfCredits ? (
            <div className="mb-4 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-200">
              You&apos;re out of Ludwitt credits.{" "}
              <a
                href={TOPUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                Top up at Ludwitt →
              </a>
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-lg border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <form onSubmit={submit} className="space-y-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              required
              placeholder="Ask anything…"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-neutral-700 dark:bg-neutral-950"
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Asking…" : "Ask"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
