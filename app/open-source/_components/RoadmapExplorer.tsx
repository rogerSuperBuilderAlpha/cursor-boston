/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import {
  ArrowUpRight,
  Eye,
  FilePlus2,
  FileText,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildRoadmapIssueUrl,
  countRoadmapItems,
  DIFFICULTY_LABELS,
  filterRoadmapCategories,
  ROADMAP_CATEGORIES,
  type RoadmapCategory,
  type RoadmapCategoryKey,
  type RoadmapDifficulty,
  type RoadmapIconKey,
  type RoadmapItem,
} from "@/lib/open-source-roadmap";

type CategoryFilter = RoadmapCategoryKey | "all";
type DifficultyFilter = RoadmapDifficulty | "all";

const CATEGORY_ICONS: Record<RoadmapIconKey, LucideIcon> = {
  zap: Zap,
  refresh: RefreshCw,
  eye: Eye,
  "file-text": FileText,
  settings: Settings,
};

const CATEGORY_STYLES: Record<
  RoadmapCategory["accent"],
  { panel: string; icon: string; text: string }
> = {
  emerald: {
    panel: "border-emerald-500/20 bg-emerald-500/5",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  blue: {
    panel: "border-blue-500/20 bg-blue-500/5",
    icon: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    text: "text-blue-700 dark:text-blue-300",
  },
  violet: {
    panel: "border-violet-500/20 bg-violet-500/5",
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    text: "text-violet-700 dark:text-violet-300",
  },
  amber: {
    panel: "border-amber-500/20 bg-amber-500/5",
    icon: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    text: "text-amber-800 dark:text-amber-300",
  },
  rose: {
    panel: "border-rose-500/20 bg-rose-500/5",
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    text: "text-rose-700 dark:text-rose-300",
  },
};

const DIFFICULTY_STYLES: Record<RoadmapDifficulty, string> = {
  beginner:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  intermediate:
    "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  advanced:
    "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

function RoadmapCard({ item }: { item: RoadmapItem }) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900/70 dark:hover:border-neutral-700">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-semibold text-neutral-950 dark:text-white">
          {item.title}
        </h4>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${DIFFICULTY_STYLES[item.difficulty]}`}
        >
          {DIFFICULTY_LABELS[item.difficulty]}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        {item.description}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {item.skills.map((skill) => (
          <span
            key={skill}
            className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            {skill}
          </span>
        ))}
      </div>
      <a
        href={buildRoadmapIssueUrl(item)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
      >
        Start from this idea
        <ArrowUpRight size={14} aria-hidden="true" />
      </a>
    </article>
  );
}

function RoadmapCategoryPanel({ category }: { category: RoadmapCategory }) {
  const Icon = CATEGORY_ICONS[category.iconKey];
  const styles = CATEGORY_STYLES[category.accent];

  return (
    <section className={`rounded-lg border p-5 ${styles.panel}`}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${styles.icon}`}
        >
          <Icon size={20} aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold text-neutral-950 dark:text-white">
          {category.label}
        </h3>
        <span className="text-sm text-neutral-500">
          {category.items.length} ideas
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {category.items.map((item) => (
          <RoadmapCard key={item.title} item={item} />
        ))}
      </div>
    </section>
  );
}

export function RoadmapExplorer() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");

  const filteredCategories = useMemo(
    () => filterRoadmapCategories({ query, category, difficulty }),
    [category, difficulty, query]
  );
  const resultCount = countRoadmapItems(filteredCategories);
  const totalCount = countRoadmapItems();
  const hasFilters = query.trim() !== "" || category !== "all" || difficulty !== "all";

  return (
    <section
      id="roadmap"
      className="border-b border-neutral-200 px-6 py-12 dark:border-neutral-800 md:py-16"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h2 className="mb-4 text-3xl font-bold text-neutral-950 dark:text-white">
            Contribution Roadmap
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
            Find something that excites you. Search by skill, category, or
            difficulty, then open a pre-filled issue when you are ready to
            start.
          </p>
        </div>

        <div className="mb-8 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/70">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_14rem_auto]">
            <label className="relative block">
              <span className="sr-only">Search roadmap ideas</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by skill, title, or outcome"
                className="h-11 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </label>

            <label className="relative block">
              <span className="sr-only">Filter by category</span>
              <SlidersHorizontal
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                aria-hidden="true"
              />
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as CategoryFilter)
                }
                className="h-11 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              >
                <option value="all">All categories</option>
                {ROADMAP_CATEGORIES.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="sr-only">Filter by difficulty</span>
              <select
                value={difficulty}
                onChange={(event) =>
                  setDifficulty(event.target.value as DifficultyFilter)
                }
                className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              >
                <option value="all">All difficulties</option>
                {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setDifficulty("all");
              }}
              disabled={!hasFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <RotateCcw size={15} aria-hidden="true" />
              Reset
            </button>
          </div>
          <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            Showing {resultCount} of {totalCount} roadmap ideas.
          </div>
        </div>

        {filteredCategories.length > 0 ? (
          <div className="space-y-6">
            {filteredCategories.map((roadmapCategory) => (
              <RoadmapCategoryPanel
                key={roadmapCategory.key}
                category={roadmapCategory}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-900">
            <p className="font-medium text-neutral-950 dark:text-white">
              No roadmap ideas match those filters.
            </p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Try a broader search or propose a new contribution idea.
            </p>
          </div>
        )}

        <div className="mt-10 rounded-lg border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="mb-2 text-lg font-semibold text-neutral-950 dark:text-white">
            Have Your Own Idea?
          </h3>
          <p className="mb-4 text-neutral-600 dark:text-neutral-400">
            Don&apos;t see what you want to build? Propose your own feature or
            improvement.
          </p>
          <a
            href="https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/new?template=feature_request.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-200 px-5 py-2.5 font-medium text-neutral-950 transition-colors hover:bg-neutral-300 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
          >
            <FilePlus2 size={16} aria-hidden="true" />
            Propose a Feature
          </a>
        </div>
      </div>
    </section>
  );
}
