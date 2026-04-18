/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Search, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { Question, QuestionSort, VoteType } from "@/types/questions";
import { QuestionCard } from "./QuestionCard";
import { TagFilter } from "./TagFilter";

async function fetchIdToken(firebaseUser: import("firebase/auth").User) {
  const { getIdToken } = await import("firebase/auth");
  return getIdToken(firebaseUser);
}

export function QuestionsListing() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [sort, setSort] = useState<QuestionSort>("newest");
  const [tag, setTag] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [userVotes, setUserVotes] = useState<Record<string, VoteType>>({});
  const [votingId, setVotingId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchQuestions = useCallback(
    async (cursor?: string): Promise<{ questions: Question[]; nextCursor: string | null }> => {
      try {
        const params = new URLSearchParams();
        params.set("sort", sort);
        params.set("limit", "20");
        if (tag) params.set("tag", tag);
        if (search) params.set("search", search);
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/questions?${params}`);
        if (!res.ok) return { questions: [], nextCursor: null };
        return await res.json();
      } catch {
        return { questions: [], nextCursor: null };
      }
    },
    [sort, tag, search]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchQuestions()
      .then((data) => {
        if (cancelled) return;
        setQuestions(data.questions);
        setNextCursor(data.nextCursor);
      })
      .catch(() => {
        if (cancelled) return;
        setQuestions([]);
        setNextCursor(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fetchQuestions]);

  // Fetch user votes
  useEffect(() => {
    if (!user) { setUserVotes({}); return; }
    (async () => {
      try {
        const token = await fetchIdToken(user);
        const res = await fetch("/api/questions/vote", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setUserVotes(data.userVotes || {});
        }
      } catch {
        // Non-critical
      }
    })();
  }, [user]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchQuestions(nextCursor);
    setQuestions((prev) => [...prev, ...data.questions]);
    setNextCursor(data.nextCursor);
    setLoadingMore(false);
  };

  const handleVote = useCallback(
    async (questionId: string, type: VoteType) => {
      if (!user || votingId) return;
      setVotingId(questionId);
      try {
        const token = await fetchIdToken(user);
        const res = await fetch("/api/questions/vote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ targetType: "question", targetId: questionId, type }),
        });
        if (res.ok) {
          const result = await res.json();
          setQuestions((prev) =>
            prev.map((q) =>
              q.id === questionId
                ? { ...q, upCount: result.upCount, downCount: result.downCount, netScore: result.netScore }
                : q
            )
          );
          setUserVotes((prev) => {
            const next = { ...prev };
            if (result.action === "removed") {
              delete next[questionId];
            } else {
              next[questionId] = result.type;
            }
            return next;
          });
        }
      } finally {
        setVotingId(null);
      }
    },
    [user, votingId]
  );

  const effectiveSort = useMemo(() => (search ? "newest" : sort), [search, sort]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Community Q&A</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Ask questions about Cursor workflows, prompting patterns, and AI-assisted development
          </p>
        </div>
        {user && (
          <Link
            href="/questions/ask"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 shrink-0"
          >
            <Plus size={16} />
            Ask Question
          </Link>
        )}
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search questions..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-background text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select
          value={effectiveSort}
          onChange={(e) => setSort(e.target.value as QuestionSort)}
          disabled={!!search}
          className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
        >
          <option value="newest">Newest</option>
          <option value="top">Top Voted</option>
          <option value="unanswered">Unanswered</option>
        </select>
      </div>

      {/* Tag filter */}
      <div className="mb-6">
        <TagFilter activeTag={tag} onTagChange={setTag} />
      </div>

      {/* Question list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-500">No questions found</p>
          {user && (
            <Link
              href="/questions/ask"
              className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline mt-2 inline-block"
            >
              Be the first to ask a question
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              userVote={userVotes[q.id]}
              isLoggedIn={!!user}
              isVoting={votingId === q.id}
              onVote={handleVote}
              onTagClick={(t) => setTag(t)}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {nextCursor && (
        <div className="flex justify-center mt-8">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {loadingMore ? (
              <Loader2 size={16} className="animate-spin inline mr-2" />
            ) : null}
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
