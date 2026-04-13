/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState, useMemo } from "react";
import { Search, Plus, X } from "lucide-react";
import { AlphabetNav } from "@/components/glossary/AlphabetNav";
import { GlossaryTermCard } from "@/components/glossary/GlossaryTermCard";
import { GlossaryForm } from "@/components/glossary/GlossaryForm";
import { GlossaryTerm } from "@/types/glossary";

interface Props {
  initialTerms: GlossaryTerm[];
}

export default function GlossaryListing({ initialTerms }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const filteredTerms = useMemo(() => {
    return initialTerms.filter((t) => {
      const matchSearch =
        t.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.definition.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchLetter = !activeLetter || t.term.toUpperCase().startsWith(activeLetter);
      
      return matchSearch && matchLetter;
    });
  }, [initialTerms, searchTerm, activeLetter]);

  const availableLetters = useMemo(() => {
    return new Set(initialTerms.map((t) => t.term[0].toUpperCase()));
  }, [initialTerms]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Glossary
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl">
            A collaboratively-edited guide to AI development concepts and the Cursor ecosystem.
          </p>
        </div>
        
        {!isFormOpen && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10 shrink-0"
          >
            <Plus className="w-5 h-5" />
            Add New Term
          </button>
        )}
      </div>

      {isFormOpen ? (
        <div className="mb-16 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Submit a New Concept</h2>
            <button
              onClick={() => setIsFormOpen(false)}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <GlossaryForm
            onSuccess={(slug) => {
              setIsFormOpen(false);
              // In a real app, we might want to refresh the list or show a toast
              window.location.href = `/glossary/${slug}`;
            }}
            onCancel={() => setIsFormOpen(false)}
          />
        </div>
      ) : (
        <>
          <div className="relative mb-8 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              placeholder="Search concepts, tools, or workflows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm group-hover:shadow-md"
            />
          </div>

          <AlphabetNav
            activeLetter={activeLetter}
            onLetterClick={(l) => setActiveLetter(l || null)}
            availableLetters={availableLetters}
          />

          {filteredTerms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTerms.map((term) => (
                <GlossaryTermCard key={term.id} term={term} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800">
              <p className="text-neutral-500 dark:text-neutral-400 text-lg">
                No terms found matching your criteria.
              </p>
              {(searchTerm || activeLetter) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setActiveLetter(null);
                  }}
                  className="mt-4 text-emerald-500 font-bold hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
