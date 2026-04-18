/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { QUESTION_TAGS, type QuestionTag } from "@/types/questions";

const TAG_LABELS: Record<QuestionTag, string> = {
  "cursor-rules": "Cursor Rules",
  prompting: "Prompting",
  debugging: "Debugging",
  refactoring: "Refactoring",
  testing: "Testing",
  architecture: "Architecture",
  performance: "Performance",
  workflows: "Workflows",
  mcp: "MCP",
  agents: "Agents",
  other: "Other",
};

export function AskQuestionForm() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedTags, setSelectedTags] = useState<QuestionTag[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: QuestionTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 5)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const { getIdToken } = await import("firebase/auth");
      const token = await getIdToken(user);

      const res = await fetch("/api/questions/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ title, body, tags: selectedTags }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to post question");
      }

      const { questionId } = await res.json();
      router.push(`/questions/${questionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post question");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-foreground mb-2">Ask a Question</h1>
        <p className="text-neutral-500">Sign in to ask a question</p>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/questions"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Q&A
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-6">Ask a Question</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="q-title" className="block text-sm font-medium text-foreground mb-1">
            Title
          </label>
          <input
            id="q-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's your question? (10-200 characters)"
            maxLength={200}
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-background text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-xs text-neutral-500 mt-1 block">{title.length}/200</span>
        </div>

        <div>
          <label htmlFor="q-body" className="block text-sm font-medium text-foreground mb-1">
            Details
          </label>
          <textarea
            id="q-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Provide more context... (20-5000 characters)"
            rows={8}
            maxLength={5000}
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-background text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
          />
          <span className="text-xs text-neutral-500 mt-1 block">{body.length}/5000</span>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Tags (up to 5)
          </label>
          <div className="flex flex-wrap gap-2">
            {QUESTION_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={[
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                  selectedTags.includes(tag)
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700",
                ].join(" ")}
              >
                {TAG_LABELS[tag]}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting || title.trim().length < 10 || body.trim().length < 20}
          className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          {submitting ? "Posting..." : "Post Question"}
        </button>
      </form>
    </div>
  );
}
