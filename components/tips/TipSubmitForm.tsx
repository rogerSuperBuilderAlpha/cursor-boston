/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { TIP_CATEGORIES } from "@/types/tips";

const MAX_CONTENT_LENGTH = 500;

export function TipSubmitForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("General");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { getIdToken } = await import("firebase/auth");
      const token = await getIdToken(user);

      const res = await fetch("/api/tips/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, content, category }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to submit");
      }

      setSuccess(true);
      setTitle("");
      setContent("");
      setCategory("General");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="p-8 text-center bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700">
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          Sign in to share a Cursor workflow tip with the community.
        </p>
        <Link
          href="/login?redirect=/tips/submit"
          className="inline-flex items-center px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-8 text-center bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800">
        <p className="text-emerald-700 dark:text-emerald-400 font-semibold mb-2">
          Tip submitted!
        </p>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm">
          Your tip will be reviewed and published soon.
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="mt-4 text-emerald-500 font-bold hover:underline text-sm"
        >
          Submit another tip
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
        <div>
          <label
            htmlFor="tip-title"
            className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-tight"
          >
            Tip Title
          </label>
          <input
            id="tip-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            placeholder='e.g. "Use Cmd+K to inline edit any selection"'
          />
        </div>

        <div>
          <label
            htmlFor="tip-category"
            className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-tight"
          >
            Category
          </label>
          <select
            id="tip-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          >
            {TIP_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="tip-content"
            className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-tight"
          >
            Tip Content
          </label>
          <textarea
            id="tip-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            maxLength={MAX_CONTENT_LENGTH}
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
            placeholder="Share a 2-3 sentence workflow tip..."
          />
          <p className="mt-1 text-xs text-neutral-500 text-right">
            {content.length}/{MAX_CONTENT_LENGTH}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Submit Tip
            </>
          )}
        </button>
      </div>
    </form>
  );
}
