/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Edit3, Calendar, User, Tag } from "lucide-react";
import { GlossaryTerm } from "@/types/glossary";
import { GlossaryForm } from "@/components/glossary/GlossaryForm";
import ReactMarkdown from "react-markdown";

interface Props {
  term: GlossaryTerm;
}

export default function GlossaryDetail({ term }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <button
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-2 text-neutral-500 hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Definition
          </button>
          <h1 className="text-3xl font-bold">Suggest Edit for &quot;{term.term}&quot;</h1>
        </div>
        <GlossaryForm
          initialData={term}
          onSuccess={() => setIsEditing(false)}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <article className="max-w-4xl mx-auto px-6 py-12 md:py-20">
      <Link
        href="/glossary"
        className="inline-flex items-center gap-2 text-neutral-500 hover:text-emerald-500 transition-colors mb-8 group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Glossary
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider rounded-full ring-1 ring-emerald-500/20">
              {term.category || "General"}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground tracking-tight">
            {term.term}
          </h1>
        </div>

        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 px-6 py-3 border border-neutral-200 dark:border-neutral-800 rounded-xl font-bold hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all shrink-0"
        >
          <Edit3 className="w-4 h-4" />
          Suggest Edit
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        <div className="lg:col-span-3">
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <div className="text-lg md:text-xl text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
              <ReactMarkdown>{term.definition}</ReactMarkdown>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-neutral-100 dark:border-neutral-900 grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="flex items-center gap-4 text-sm text-neutral-500">
              <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-foreground">Contributed by</p>
                <p>{term.createdBy.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-neutral-500">
              <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-foreground">Last Updated</p>
                <p>{new Date(term.updatedAt || term.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-1 space-y-8">
          <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <h4 className="font-bold text-sm uppercase tracking-wider text-neutral-400 mb-4">
              Metadata
            </h4>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Tag className="w-4 h-4 text-emerald-500" />
                <span className="text-neutral-600 dark:text-neutral-400">Slug: {term.slug}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-neutral-600 dark:text-neutral-400">Status: Approved</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
