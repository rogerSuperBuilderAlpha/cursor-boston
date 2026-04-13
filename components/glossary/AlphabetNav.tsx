/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

interface Props {
  activeLetter: string | null;
  onLetterClick: (letter: string) => void;
  availableLetters: Set<string>;
}

export function AlphabetNav({ activeLetter, onLetterClick, availableLetters }: Props) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  return (
    <nav className="flex flex-wrap gap-2 mb-8 p-1 bg-neutral-100/50 dark:bg-neutral-900/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
      <button
        onClick={() => onLetterClick("")}
        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
          !activeLetter
            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
            : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        }`}
      >
        ALL
      </button>
      {alphabet.map((char) => {
        const hasTerms = availableLetters.has(char);
        const isActive = activeLetter === char;

        return (
          <button
            key={char}
            onClick={() => hasTerms && onLetterClick(char)}
            disabled={!hasTerms}
            className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-all ${
              isActive
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                : hasTerms
                ? "text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 shadow-sm"
                : "text-neutral-300 dark:text-neutral-700 cursor-not-allowed opacity-50"
            }`}
          >
            {char}
          </button>
        );
      })}
    </nav>
  );
}
