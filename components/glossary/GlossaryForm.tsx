/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Edit } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  initialData?: {
    term: string;
    definition: string;
    category?: string;
  };
  onSuccess: (slug: string) => void;
  onCancel?: () => void;
}

export function GlossaryForm({ initialData, onSuccess, onCancel }: Props) {
  const { user } = useAuth();
  const [term, setTerm] = useState(initialData?.term || "");
  const [definition, setDefinition] = useState(initialData?.definition || "");
  const [category, setCategory] = useState(initialData?.category || "General");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!initialData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setError(null);

    try {
      const { getIdToken } = await import("firebase/auth");
      const token = await getIdToken(user);

      const res = await fetch("/api/glossary/term", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ term, definition, category }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to submit");
      }

      onSuccess(data.slug);
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
          Sign in to contribute to the Cursor glossary.
        </p>
        <Link
          href="/login?redirect=/glossary"
          className="inline-flex items-center px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
        <div>
          <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-tight">
            Term Name
          </label>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            disabled={isEdit}
            required
            className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:opacity-50"
            placeholder="e.g. Multi-cursor editing"
          />
          {isEdit && (
            <p className="mt-2 text-xs text-neutral-500">
              Term name cannot be changed once created. Submit a new term if needed.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-tight">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          >
            <option value="General">General</option>
            <option value="Cursor Features">Cursor Features</option>
            <option value="AI Concepts">AI Concepts</option>
            <option value="Development">Development</option>
            <option value="Multi-cursor">Multi-cursor</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-tight">
            Definition
          </label>
          <textarea
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            required
            rows={5}
            className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
            placeholder="Describe the concept in detail..."
          />
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isEdit ? (
              <>
                <Edit className="w-5 h-5" />
                Suggest Edit
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Add Term
              </>
            )}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-8 py-4 border border-neutral-200 dark:border-neutral-800 rounded-xl font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
