"use client";

import {
  useState,
  useEffect,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import {
  COOKBOOK_CATEGORIES,
  WORKS_WITH_LANGUAGES,
  type CookbookEntry,
  type CookbookCategory,
  type WorksWithTag,
} from "@/types/cookbook";

const CATEGORY_LABELS: Record<CookbookCategory, string> = {
  debugging: "Debugging",
  refactoring: "Refactoring",
  "code-generation": "Code Generation",
  testing: "Testing",
  documentation: "Documentation",
  architecture: "Architecture",
  other: "Other",
};

function PromptMarkdown({ content, className }: { content: string; className?: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const components = {
    p: ({ children }: { children?: React.ReactNode }) => <div className="mb-2 last:mb-0 text-sm text-neutral-700 dark:text-neutral-300">{children}</div>,
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
    li: ({ children }: { children?: React.ReactNode }) => <li className="text-sm text-neutral-700 dark:text-neutral-300">{children}</li>,
    h1: ({ children }: { children?: React.ReactNode }) => <h1 className="text-base font-bold mt-2 mb-1 first:mt-0">{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-sm font-bold mt-2 mb-1 first:mt-0">{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h3>,
    code: ({ inline, className: codeClassName, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
      if (inline) {
        return (
          <code className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-mono" {...props}>{children}</code>
        );
      }
      const match = /language-(\w+)/.exec(codeClassName || "");
      const lang = match ? match[1] : "text";
      const raw = Array.isArray(children) ? children.join("") : String(children ?? "");
      return (
        <SyntaxHighlighter
          language={lang}
          style={isDark ? oneDark : oneLight}
          PreTag="div"
          customStyle={{ margin: 0, marginTop: "0.5rem", marginBottom: "0.5rem", borderRadius: "0.5rem", fontSize: "0.8125rem" }}
          codeTagProps={{ style: { fontFamily: "ui-monospace, monospace" } }}
          showLineNumbers={false}
          wrapLongLines
        >
          {raw}
        </SyntaxHighlighter>
      );
    },
    pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
    blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="border-l-2 border-neutral-300 dark:border-neutral-600 pl-3 my-1 text-neutral-600 dark:text-neutral-400 text-sm">{children}</blockquote>,
  };

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

interface VoteCounts {
  [entryId: string]: { upCount: number; downCount: number };
}

interface UserVotes {
  [entryId: string]: string;
}

function getNetScore(votes: VoteCounts, entryId: string): number {
  const v = votes[entryId];
  if (!v) return 0;
  return v.upCount - v.downCount;
}

export default function CookbookPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<CookbookEntry[]>([]);
  const [votes, setVotes] = useState<VoteCounts>({});
  const [userVotes, setUserVotes] = useState<UserVotes>({});
  const [votingId, setVotingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [category, setCategory] = useState<string>("");
  const [worksWith, setWorksWith] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "top">("top");
  const [viewingEntry, setViewingEntry] = useState<CookbookEntry | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

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
        if (category) params.set("category", category);
        if (worksWith) params.set("worksWith", worksWith);
        if (search) params.set("search", search);
        if (append && cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/cookbook/entries?${params}`);
        if (res.ok) {
          const data = await res.json();
          const list = data.entries || [];
          setEntries((prev) => (append ? [...prev, ...list] : list));
          setNextCursor(data.nextCursor ?? null);
          setHasMore(!!data.hasMore);
          setVotes((prev) => {
            const next = { ...prev };
            list.forEach((e: CookbookEntry) => {
              next[e.id] = { upCount: e.upCount ?? 0, downCount: e.downCount ?? 0 };
            });
            return next;
          });
        }
      } catch {
        if (!append) setEntries([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, worksWith, search]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || !nextCursor) return;
    fetchEntries(true, nextCursor);
  }, [hasMore, loadingMore, nextCursor, fetchEntries]);

  const fetchVotes = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (user) {
        const { getIdToken } = await import("firebase/auth");
        const token = await getIdToken(user);
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch("/api/cookbook/vote", { headers });
      if (res.ok) {
        const data = await res.json();
        setUserVotes(data.userVotes || {});
      }
    } catch {
      // Silently fail
    }
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    fetchVotes();
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
          const data = await res.json();
          setVotes((prev) => ({
            ...prev,
            [entryId]: {
              upCount: data.upCount,
              downCount: data.downCount,
            },
          }));
          if (data.action === "removed") {
            setUserVotes((prev) => {
              const next = { ...prev };
              delete next[entryId];
              return next;
            });
          } else {
            setUserVotes((prev) => ({ ...prev, [entryId]: type }));
          }
        }
      } catch {
        // Silently fail
      } finally {
        setVotingId(null);
      }
    },
    [user, votingId]
  );

  const sortedEntries = [...entries].sort((a, b) => {
    if (sortBy === "top") {
      return getNetScore(votes, b.id) - getNetScore(votes, a.id);
    }
    if (sortBy === "newest") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return (
    <div className="flex flex-col">
      {/* Hero */}
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

      {/* Submit CTA */}
      <section className="px-6 py-10 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <button
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
              <CookbookForm
                user={user}
                onSuccess={() => {
                  setFormOpen(false);
                  fetchEntries();
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

      {/* Main content */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
          {/* Filter sidebar */}
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

          {/* Entries grid */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                  Prompts & Rules
                </h2>
                <span className="text-sm text-neutral-500">
                  {sortedEntries.length} entr{sortedEntries.length !== 1 ? "ies" : "y"}
                </span>
              </div>
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
                  onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "top")}
                  className="px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="top">Top rated</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
              </div>
            ) : sortedEntries.length === 0 ? (
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
                  entries={sortedEntries}
                  votes={votes}
                  userVotes={userVotes}
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
                      onClick={loadMore}
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
                votes={votes[viewingEntry.id]}
                userVote={userVotes[viewingEntry.id]}
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

function CookbookEntries({
  entries,
  votes,
  userVotes,
  isLoggedIn,
  votingId,
  onVote,
  onViewFull,
  onTagClick,
}: {
  entries: CookbookEntry[];
  votes: VoteCounts;
  userVotes: UserVotes;
  isLoggedIn: boolean;
  votingId: string | null;
  onVote: (entryId: string, type: "up" | "down") => void;
  onViewFull: (entry: CookbookEntry) => void;
  onTagClick?: (tag: string) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-6">
      {entries.map((entry) => (
        <CookbookCard
          key={entry.id}
          entry={entry}
          votes={votes[entry.id]}
          userVote={userVotes[entry.id]}
          isLoggedIn={isLoggedIn}
          isVoting={votingId === entry.id}
          onVote={onVote}
          onViewFull={onViewFull}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  );
}

function CookbookCard({
  entry,
  votes,
  userVote,
  isLoggedIn,
  isVoting,
  onVote,
  onViewFull,
  onTagClick,
}: {
  entry: CookbookEntry;
  votes?: { upCount: number; downCount: number };
  userVote?: string;
  isLoggedIn: boolean;
  isVoting: boolean;
  onVote: (entryId: string, type: "up" | "down") => void;
  onViewFull: (entry: CookbookEntry) => void;
  onTagClick?: (tag: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const upCount = votes?.upCount || 0;
  const downCount = votes?.downCount || 0;
  const netScore = upCount - downCount;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entry.promptContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  const previewLength = 600;
  const preview = entry.promptContent.slice(0, previewLength);
  const hasMore = entry.promptContent.length > previewLength;

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const MAX_WORKS_WITH = 4;
  const MAX_TAGS = 3;
  const worksWithList = entry.worksWith ?? [];
  const tagsList = entry.tags ?? [];
  const worksWithDisplay = worksWithList.slice(0, MAX_WORKS_WITH);
  const worksWithMore = worksWithList.length - MAX_WORKS_WITH;
  const tagsDisplay = tagsList.slice(0, MAX_TAGS);
  const tagsMore = tagsList.length - MAX_TAGS;

  return (
    <div className="group h-full flex flex-col bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:shadow-lg dark:hover:shadow-emerald-500/5 transition-all duration-200">
      <div className="p-6 flex flex-col flex-1 min-h-0">
        <h3 className="text-lg font-bold text-foreground mb-2">{entry.title}</h3>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed mb-4 line-clamp-2">
          {entry.description}
        </p>

        {/* Code preview with header bar */}
        <div className="relative rounded-xl overflow-hidden mb-4 border border-neutral-200 dark:border-neutral-700/80 bg-neutral-50 dark:bg-neutral-950 shadow-inner">
          <div className="flex items-center justify-between px-3 py-2 bg-neutral-100 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700/80">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Prompt
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewFull(entry);
                }}
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors"
              >
                View full
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
                className="px-2 py-1 rounded-md bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
          <PromptMarkdown
            content={`${preview}${hasMore ? "\n\n…" : ""}`}
            className="h-32 overflow-y-auto overflow-x-hidden px-3 py-2 text-sm [&>*:last-child]:mb-0"
          />
        </div>

        {/* Category, works with, tags - flex-1 absorbs remaining space */}
        <div className="flex-1 flex flex-col justify-start gap-3 mb-4">
          <div>
            <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-full">
              {CATEGORY_LABELS[entry.category as CookbookCategory] || entry.category}
            </span>
          </div>
          {worksWithList.length > 0 && (
            <div>
              <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wider">
                Works with
              </span>
              <div className="flex flex-wrap gap-1.5">
                {worksWithDisplay.map((w) => (
                  <span
                    key={w}
                    className="px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium rounded-full"
                  >
                    {w}
                  </span>
                ))}
                {worksWithMore > 0 && (
                  <span className="px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-xs font-medium rounded-full">
                    +{worksWithMore}
                  </span>
                )}
              </div>
            </div>
          )}
          {tagsList.length > 0 && (
            <div>
              <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wider">
                Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tagsDisplay.map((tag) =>
                  onTagClick ? (
                    <button
                      key={tag}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTagClick(tag);
                      }}
                      className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-neutral-800 dark:hover:text-neutral-200 text-xs font-medium rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      {tag}
                    </button>
                  ) : (
                    <span
                      key={tag}
                      className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-medium rounded-full"
                    >
                      {tag}
                    </span>
                  )
                )}
                {tagsMore > 0 && (
                  <span className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-xs font-medium rounded-full">
                    +{tagsMore}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Author, date & Voting */}
        <div className="mt-auto pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Link
              href={`/members?search=${encodeURIComponent(entry.authorDisplayName)}`}
              className="text-xs text-neutral-500 hover:text-foreground transition-colors"
            >
              by {entry.authorDisplayName}
            </Link>
            {entry.createdAt && (
              <span className="text-xs text-neutral-500 block mt-0.5">
                {formatDate(entry.createdAt)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onVote(entry.id, "up")}
              disabled={!isLoggedIn || isVoting}
              title={isLoggedIn ? "Upvote" : "Sign in to vote"}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors ${
                userVote === "up"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 10v12" />
                <path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88z" />
              </svg>
              <span>{upCount}</span>
            </button>

            <span
              className={`text-sm font-semibold min-w-8 text-center ${
                netScore > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : netScore < 0
                    ? "text-red-500"
                    : "text-neutral-500"
              }`}
            >
              {netScore > 0 ? `+${netScore}` : netScore}
            </span>

            <button
              onClick={() => onVote(entry.id, "down")}
              disabled={!isLoggedIn || isVoting}
              title={isLoggedIn ? "Downvote" : "Sign in to vote"}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors ${
                userVote === "down"
                  ? "bg-red-500/10 text-red-500"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 14V2" />
                <path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88z" />
              </svg>
              <span>{downCount}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntryDetailModal({
  entry,
  votes,
  userVote,
  isLoggedIn,
  isVoting,
  onVote,
  onClose,
}: {
  entry: CookbookEntry;
  votes?: { upCount: number; downCount: number };
  userVote?: string;
  isLoggedIn: boolean;
  isVoting: boolean;
  onVote: (entryId: string, type: "up" | "down") => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const upCount = votes?.upCount || 0;
  const downCount = votes?.downCount || 0;
  const netScore = upCount - downCount;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entry.promptContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e: ReactKeyboardEvent) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const modal = e.currentTarget.querySelector("[data-modal-content]");
          if (!modal) return;
          const focusable = modal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <div
        data-modal-content
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="shrink-0 px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2
              id="entry-modal-title"
              className="text-xl font-bold text-foreground mb-1"
            >
              {entry.title}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
              {entry.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg text-neutral-500 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6 space-y-4">
            <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950">
              <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Full prompt
                </span>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <PromptMarkdown
                content={entry.promptContent}
                className="max-h-[40vh] overflow-y-auto overflow-x-hidden px-4 py-3 text-sm [&>*:last-child]:mb-0"
              />
            </div>

            <div className="space-y-3">
              <div>
                <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                  Category
                </span>
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-full">
                  {CATEGORY_LABELS[entry.category as CookbookCategory] || entry.category}
                </span>
              </div>
              {(entry.worksWith ?? []).length > 0 && (
                <div>
                  <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                    Works with
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(entry.worksWith ?? []).map((w) => (
                      <span
                        key={w}
                        className="px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium rounded-full"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(entry.tags ?? []).length > 0 && (
                <div>
                  <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(entry.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-medium rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950/50">
          <div>
            <Link
              href={`/members?search=${encodeURIComponent(entry.authorDisplayName)}`}
              className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
            >
              by {entry.authorDisplayName}
            </Link>
            {entry.createdAt && (
              <span className="block text-xs text-neutral-500 mt-0.5">
                {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onVote(entry.id, "up")}
              disabled={!isLoggedIn || isVoting}
              title={isLoggedIn ? "Upvote" : "Sign in to vote"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                userVote === "up"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 10v12" />
                <path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88z" />
              </svg>
              {upCount}
            </button>
            <span className={`text-sm font-semibold min-w-6 text-center ${netScore > 0 ? "text-emerald-600 dark:text-emerald-400" : netScore < 0 ? "text-red-500" : "text-neutral-500"}`}>
              {netScore > 0 ? `+${netScore}` : netScore}
            </span>
            <button
              onClick={() => onVote(entry.id, "down")}
              disabled={!isLoggedIn || isVoting}
              title={isLoggedIn ? "Downvote" : "Sign in to vote"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                userVote === "down"
                  ? "bg-red-500/10 text-red-500"
                  : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 14V2" />
                <path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88z" />
              </svg>
              {downCount}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CookbookForm({
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
      const data = await res.json();
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
      onSubmit={handleSubmit}
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
        <p className="text-xs text-neutral-500 mt-1">
          Comma-separated. Max 10 tags.
        </p>
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
            onChange={(e) =>
              setCategory(e.target.value as CookbookCategory)
            }
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
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Works with
          </label>
          <div className="flex flex-wrap gap-2">
            {WORKS_WITH_LANGUAGES.map((lang) => (
              <label
                key={lang}
                className="flex items-center gap-2 cursor-pointer"
              >
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
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {lang}
                </span>
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
