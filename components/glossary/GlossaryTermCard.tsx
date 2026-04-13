/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import Link from "next/link";
import { MoveRight } from "lucide-react";
import { GlossaryTerm } from "@/types/glossary";

interface Props {
  term: GlossaryTerm;
}

export function GlossaryTermCard({ term }: Props) {
  return (
    <Link
      href={`/glossary/${term.slug}`}
      className="group block p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 transform hover:-translate-y-1"
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-xl font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {term.term}
        </h3>
        <MoveRight className="w-5 h-5 text-neutral-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
      </div>
      
      {term.category && (
        <span className="inline-block px-2 py-0.5 mb-3 text-[10px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-md">
          {term.category}
        </span>
      )}
      
      <p className="text-neutral-600 dark:text-neutral-400 text-sm line-clamp-3 leading-relaxed">
        {term.definition}
      </p>
    </Link>
  );
}
