/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ecosystemData from "@/content/ecosystem.json";

type Category =
  | "university"
  | "accelerator"
  | "ai_org"
  | "vc"
  | "research_lab"
  | "nonprofit";

interface EcosystemEntry {
  id: string;
  name: string;
  fullName: string;
  category: Category;
  location: string;
  website: string;
  description: string;
  tags: string[];
}

const CATEGORY_LABEL: Record<Category, string> = {
  university: "Universities",
  accelerator: "Accelerators",
  ai_org: "AI organizations",
  vc: "Venture capital",
  research_lab: "Research labs",
  nonprofit: "Nonprofits",
};

const CATEGORY_BADGE: Record<Category, string> = {
  university: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  accelerator: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  ai_org: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  vc: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  research_lab: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  nonprofit: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

const CATEGORY_ORDER: Category[] = [
  "university",
  "accelerator",
  "ai_org",
  "vc",
  "research_lab",
  "nonprofit",
];

export default function EcosystemPage() {
  const entries = ecosystemData.entries as EcosystemEntry[];
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    for (const cat of CATEGORY_ORDER) {
      c[cat] = entries.filter((e) => e.category === cat).length;
    }
    return c;
  }, [entries]);

  const visibleEntries = useMemo(() => {
    if (activeCategory === "all") return entries;
    return entries.filter((e) => e.category === activeCategory);
  }, [entries, activeCategory]);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Mass AI Ecosystem
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Universities, accelerators, research labs, nonprofits, and venture
            firms shaping AI and technology across Massachusetts.
          </p>
        </div>
      </section>

      {/* Contribute CTA */}
      <section className="py-6 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
          <p className="text-neutral-700 dark:text-neutral-300">
            <strong>Is something missing?</strong> Add an entry by opening a PR that edits <code className="font-mono text-xs">content/ecosystem.json</code>.
          </p>
          <a
            href="https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/develop/docs/ADD_CONTENT.md#add-an-ecosystem-entry"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white focus-visible:ring-offset-2"
          >
            How to add an entry →
          </a>
        </div>
      </section>

      {/* Category filter chips */}
      <section className="py-6 px-6 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              activeCategory === "all"
                ? "bg-foreground text-background"
                : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600"
            }`}
          >
            All <span className="text-xs opacity-60 ml-1">({counts.all})</span>
          </button>
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              disabled={counts[cat] === 0}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed ${
                activeCategory === cat
                  ? "bg-foreground text-background"
                  : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600"
              }`}
            >
              {CATEGORY_LABEL[cat]}
              <span className="text-xs opacity-60 ml-1">({counts[cat] ?? 0})</span>
            </button>
          ))}
        </div>
      </section>

      {/* Entries grid */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          {visibleEntries.length === 0 ? (
            <p className="text-center text-neutral-600 dark:text-neutral-400 py-8">
              No entries in this category yet.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleEntries.map((e) => (
                <article
                  key={e.id}
                  className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-bold text-foreground leading-tight">
                        {e.name}
                      </h2>
                      <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5 truncate">
                        {e.fullName}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-block px-2 py-0.5 text-xs font-medium rounded-full ${CATEGORY_BADGE[e.category]}`}
                    >
                      {CATEGORY_LABEL[e.category].replace(/s$/, "")}
                    </span>
                  </div>

                  <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4 flex-1">
                    {e.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-500 mb-3">
                    <span>{e.location}</span>
                  </div>

                  {e.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {e.tags.map((t) => (
                        <span
                          key={t}
                          className="inline-block px-2 py-0.5 text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <a
                    href={e.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:underline mt-auto"
                  >
                    Visit website
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M7 17l9.2-9.2M17 17V7H7" />
                    </svg>
                  </a>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Related CTA */}
      <section className="py-12 px-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-3">
            Looking for something else?
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-6">
            Check out active job listings, co-founder roles, and community events.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/opportunities"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 text-sm font-medium"
            >
              Opportunities →
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 text-sm font-medium"
            >
              Events →
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 text-sm font-medium"
            >
              About →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
