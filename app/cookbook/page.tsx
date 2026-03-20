"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { COOKBOOK_CATEGORIES, WORKS_WITH_LANGUAGES } from "@/types/cookbook";
import type { CookbookEntry } from "@/types/cookbook";
import { CATEGORY_LABELS } from "@/lib/cookbook-labels";
import { CookbookEntries } from "@/components/cookbook/CookbookEntries";
import { EntryDetailModal } from "@/components/cookbook/EntryDetailModal";
import { SubmitForm } from "@/components/cookbook/SubmitForm";

type CookbookSort = "newest" | "oldest" | "top";

interface EntryVoteState {
  upCount: number;
  downCount: number;
  userVote?: "up" | "down";
}

export default function CookbookPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<CookbookEntry[]>([]);
  const [voteState, setVoteState] = useState<Record<string, EntryVoteState>>({});
  const [votingId, setVotingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [category, setCategory] = useState<string>("");
  const [worksWith, setWorksWith] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<CookbookSort>("newest");
  const [viewingEntry, setViewingEntry] = useState<CookbookEntry | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const effectiveSort: CookbookSort = search ? "newest" : sortBy;

  const mergeVotesFromEntries = useCallback((list: CookbookEntry[]) => {
    setVoteState((prev) => {
      const next = { ...prev };
      for (const e of list) {
        const prior = prev[e.id];
        next[e.id] = {
          upCount: e.upCount ?? 0,
          downCount: e.downCount ?? 0,
          userVote: prior?.userVote,
        };
      }
      return next;
    });
  }, []);

  const fetchEntries = useCallback(
    async (append: boolean = false, cursor: string | null = null) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const params = new URLSearchParams();
        params.set("limit", "12");
        params.set("sort", effectiveSort);
        if (category) params.set("category", category);
        if (worksWith) params.set("worksWith", worksWith);
        if (search) params.set("search", search);
        if (append && cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/cookbook/entries?${params}`);
        if (res.ok) {
          const data = (await res.json()) as {
            entries?: CookbookEntry[];
            nextCursor?: string | null;
            hasMore?: boolean;
          };
          const list = data.entries || [];
          setEntries((prev) => (append ? [...prev, ...list] : list));
          setNextCursor(data.nextCursor ?? null);
          setHasMore(!!data.hasMore);
          mergeVotesFromEntries(list);
        }
      } catch {
        console.warn("Cookbook: failed to load entries");
        if (!append) setEntries([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, worksWith, search, effectiveSort, mergeVotesFromEntries]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || !nextCursor) return;
    void fetchEntries(true, nextCursor);
  }, [hasMore, loadingMore, nextCursor, fetchEntries]);

  const fetchVotes = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (user) {
        const { getIdToken } = await import("firebase/auth");
        const token = await getIdToken(user);
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch("/api/cookbook/vote", { headers });
      if (res.ok) {
        const data = (await res.json()) as { userVotes?: Record<string, string> };
        const uv = data.userVotes || {};
        setVoteState((prev) => {
          const next = { ...prev };
          for (const [entryId, type] of Object.entries(uv)) {
            if (type !== "up" && type !== "down") continue;
            const cur = next[entryId] ?? { upCount: 0, downCount: 0 };
            next[entryId] = { ...cur, userVote: type };
          }
          return next;
        });
      }
    } catch {
      console.warn("Cookbook: failed to load vote state");
    }
  }, [user]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    void fetchVotes();
  }, [fetchVotes]);

  const handleVote = useCallback(
    async (entryId: string, type: "up" | "down") => {
      if (!user) return;
      if (votingId) return;
      setVotingId(entryId);
      try {
        const { getIdToken } = await import("firebase/auth");
        const token = await getIdToken(user);
        const res = await fetch("/api/cookbook/vote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ entryId, type }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            action?: string;
            upCount?: number;
            downCount?: number;
          };
          setVoteState((prev) => {
            const cur = prev[entryId] ?? { upCount: 0, downCount: 0 };
            const next = { ...prev };
            next[entryId] = {
              upCount: data.upCount ?? cur.upCount,
              downCount: data.downCount ?? cur.downCount,
              userVote:
                data.action === "removed" ? undefined : type,
            };
            return next;
          });
        }
      } catch {
        console.warn("Cookbook: vote request failed");
      } finally {
        setVotingId(null);
      }
    },
    [user, votingId]
  );

  const hasActiveFilters = !!(category || worksWith || search);
  const showFilteredEmpty =
    !loading && entries.length === 0 && hasActiveFilters;
  const showGlobalEmpty = !loading && entries.length === 0 && !hasActiveFilters;

  return (
    <div className="flex flex-col">
      <section className="py-16 md:py-24 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-gradient-to-b from-transparent via-neutral-50/50 dark:via-neutral-950/30 to-transparent">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold rounded-full mb-6 ring-1 ring-emerald-500/20">
            AI-Native Workflows
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Prompt & Rules Cookbook
          </h1>
          <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-8">
            Share and discover Cursor prompts, rules files, and AI-assisted
            development workflows. A recipe book for AI-native coding.
          </p>
        </div>
      </section>

      <section className="px-6 py-10 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setFormOpen(!formOpen)}
              className="w-full flex items-center justify-between p-6 md:p-8 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-emerald-600 dark:text-emerald-400"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">
                    Add a Prompt or Rule
                  </h2>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">
                    Share your favorite Cursor workflow with the community
                  </p>
                </div>
              </div>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`text-neutral-500 shrink-0 transition-transform ${
                  formOpen ? "rotate-180" : ""
                }`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {formOpen && (
              <SubmitForm
                user={user}
                onSuccess={() => {
                  setFormOpen(false);
                  void fetchEntries();
                }}
                isSubmitting={formSubmitting}
                setIsSubmitting={setFormSubmitting}
                error={formError}
                setError={setFormError}
              />
            )}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 px-6">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-56 shrink-0">
            <div className="sticky top-24 space-y-6 p-5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div>
                <label
                  htmlFor="cookbook-search"
                  className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2"
                >
                  Search
                </label>
                <input
                  id="cookbook-search"
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search title, description, tags..."
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label
                  htmlFor="cookbook-category"
                  className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2"
                >
                  Category
                </label>
                <select
                  id="cookbook-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">All</option>
                  {COOKBOOK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="cookbook-worksWith"
                  className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2"
                >
                  Works with
                </label>
                <select
                  id="cookbook-worksWith"
                  value={worksWith}
                  onChange={(e) => setWorksWith(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">All</option>
                  {WORKS_WITH_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                  Prompts & Rules
                </h2>
                <span className="text-sm text-neutral-500">
                  {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="cookbook-sort"
                    className="text-sm font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap"
                  >
                    Sort by
                  </label>
                  <select
                    id="cookbook-sort"
                    value={sortBy}
                    disabled={!!search}
                    onChange={(e) => setSortBy(e.target.value as CookbookSort)}
                    className="px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="top">Top rated</option>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                  </select>
                </div>
                {search ? (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 sm:text-right">
                    Sort uses newest first while searching.
                  </p>
                ) : null}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
              </div>
            ) : showFilteredEmpty ? (
              <div className="text-center py-20">
                <p className="text-neutral-600 dark:text-neutral-400 text-lg">
                  No entries match your filters. Try adjusting search or
                  filters.
                </p>
              </div>
            ) : showGlobalEmpty ? (
              <div className="text-center py-20">
                <p className="text-neutral-600 dark:text-neutral-400 text-lg">
                  No prompts yet. Be the first to add one!
                </p>
                {!user && (
                  <Link
                    href="/login?redirect=/cookbook"
                    className="inline-block mt-4 px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400"
                  >
                    Sign in to submit
                  </Link>
                )}
              </div>
            ) : (
              <>
                <CookbookEntries
                  entries={entries}
                  voteState={voteState}
                  isLoggedIn={!!user}
                  votingId={votingId}
                  onVote={handleVote}
                  onViewFull={setViewingEntry}
                  onTagClick={(tag) => setSearchInput(tag)}
                />
                {hasMore && (
                  <div className="flex justify-center mt-8">
                    <button
                      type="button"
                      onClick={() => loadMore()}
                      disabled={loadingMore}
                      className="px-6 py-3 rounded-xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium hover:bg-neutral-300 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      {loadingMore ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-emerald-500" />
                          Loading…
                        </span>
                      ) : (
                        "Load more"
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
            {viewingEntry && (
              <EntryDetailModal
                entry={viewingEntry}
                votes={voteState[viewingEntry.id]}
                userVote={voteState[viewingEntry.id]?.userVote}
                isLoggedIn={!!user}
                isVoting={votingId === viewingEntry.id}
                onVote={handleVote}
                onClose={() => setViewingEntry(null)}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
