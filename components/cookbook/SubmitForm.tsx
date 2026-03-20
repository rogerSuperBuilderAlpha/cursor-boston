"use client";

import { useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { CATEGORY_LABELS } from "@/lib/cookbook-labels";
import {
  COOKBOOK_CATEGORIES,
  WORKS_WITH_LANGUAGES,
  type CookbookCategory,
  type WorksWithTag,
} from "@/types/cookbook";

/** Authenticated form for submitting new cookbook entries with title, description, prompt, category, and tags. */
export function SubmitForm({
  user,
  onSuccess,
  isSubmitting,
  setIsSubmitting,
  error,
  setError,
}: {
  user: User | null;
  onSuccess: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [category, setCategory] = useState<CookbookCategory>("other");
  const [tagsInput, setTagsInput] = useState("");
  const [worksWith, setWorksWith] = useState<WorksWithTag[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const { getIdToken } = await import("firebase/auth");
      const token = await getIdToken(user);
      const res = await fetch("/api/cookbook/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          promptContent: promptContent.trim(),
          category,
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 10),
          worksWith,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Failed to submit");
        return;
      }
      setTitle("");
      setDescription("");
      setPromptContent("");
      setCategory("other");
      setTagsInput("");
      setWorksWith([]);
      onSuccess();
    } catch {
      setError("Failed to submit");
      console.warn("Cookbook: submit request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="px-6 md:px-8 pb-8 border-t border-neutral-200 dark:border-neutral-800 pt-6">
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Sign in to submit a prompt or rule.
        </p>
        <Link
          href="/login?redirect=/cookbook"
          className="inline-flex items-center px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="px-6 md:px-8 pb-8 border-t border-neutral-200 dark:border-neutral-800 pt-6 space-y-6"
    >
      <div>
        <label
          htmlFor="cookbook-title"
          className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
        >
          Title *
        </label>
        <input
          id="cookbook-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="e.g. Debug with stack trace"
          className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>
      <div>
        <label
          htmlFor="cookbook-description"
          className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
        >
          Description *
        </label>
        <textarea
          id="cookbook-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          maxLength={2000}
          placeholder="What does this prompt do? When would you use it?"
          className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
        />
      </div>
      <div>
        <label
          htmlFor="cookbook-prompt"
          className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
        >
          Prompt or Rule Content *
        </label>
        <textarea
          id="cookbook-prompt"
          value={promptContent}
          onChange={(e) => setPromptContent(e.target.value)}
          required
          rows={8}
          maxLength={10000}
          placeholder="Paste your prompt, .cursorrules snippet, or workflow..."
          className="w-full px-4 py-3 bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-sm resize-none"
        />
      </div>
      <div>
        <label
          htmlFor="cookbook-tags"
          className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
        >
          Tags (optional)
        </label>
        <input
          id="cookbook-tags"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="e.g. debugging, cursorrules, refactor"
          className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <p className="text-xs text-neutral-500 mt-1">Comma-separated. Max 10 tags.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="cookbook-form-category"
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
          >
            Category
          </label>
          <select
            id="cookbook-form-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CookbookCategory)}
            className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {COOKBOOK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Works with
          </span>
          <div className="flex flex-wrap gap-2">
            {WORKS_WITH_LANGUAGES.map((lang) => (
              <label key={lang} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={worksWith.includes(lang)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setWorksWith((prev) => [...prev, lang]);
                    } else {
                      setWorksWith((prev) => prev.filter((w) => w !== lang));
                    }
                  }}
                  className="rounded border-neutral-400 text-emerald-500 focus:ring-emerald-400"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">{lang}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
            Submitting...
          </>
        ) : (
          "Submit"
        )}
      </button>
    </form>
  );
}
