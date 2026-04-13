/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { TipCard } from "@/components/tips/TipCard";
import { SubscribeForm } from "@/components/tips/SubscribeForm";
import type { WeeklyTip } from "@/types/tips";

interface Props {
  initialTips: WeeklyTip[];
}

export default function TipsArchive({ initialTips }: Props) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTips = useMemo(() => {
    if (!searchTerm) return initialTips;
    const q = searchTerm.toLowerCase();
    return initialTips.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q) ||
        t.authorName.toLowerCase().includes(q)
    );
  }, [initialTips, searchTerm]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Weekly Tips
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl">
            Community-sourced Cursor workflow hacks, keyboard shortcuts, and prompt tricks.
          </p>
        </div>
        <Link
          href="/tips/submit"
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10 shrink-0"
        >
          <Plus className="w-5 h-5" />
          Submit a Tip
        </Link>
      </div>

      <div className="mb-10 p-6 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <h2 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-tight mb-3">
          Get tips in your inbox every Monday
        </h2>
        <SubscribeForm />
      </div>

      <div className="relative mb-8 group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-emerald-500 transition-colors" />
        <input
          type="text"
          placeholder="Search tips..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm group-hover:shadow-md"
        />
      </div>

      {filteredTips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTips.map((tip) => (
            <TipCard key={tip.id} tip={tip} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800">
          <p className="text-neutral-500 dark:text-neutral-400 text-lg">
            {initialTips.length === 0
              ? "No tips yet — be the first to submit one!"
              : "No tips found matching your search."}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="mt-4 text-emerald-500 font-bold hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
}
