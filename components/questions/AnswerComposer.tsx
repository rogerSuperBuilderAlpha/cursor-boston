/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";

export function AnswerComposer({
  isLoggedIn,
  onSubmit,
}: {
  isLoggedIn: boolean;
  onSubmit: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(body.trim());
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post answer");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 text-center">
        <p className="text-sm text-neutral-500">Sign in to post an answer</p>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">Your Answer</h3>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share your knowledge... (min 20 characters)"
        rows={5}
        className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-background px-3 py-2 text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
      />
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      <div className="flex justify-between items-center mt-3">
        <span className="text-xs text-neutral-500">{body.length}/5000</span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || body.trim().length < 20}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          {submitting ? "Posting..." : "Post Answer"}
        </button>
      </div>
    </div>
  );
}
