/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { Skeleton } from "@/components/ui/Skeleton";

function SectionHelpSkeleton() {
  return (
    <div className="mb-8 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
      <Skeleton className="h-6 w-44 mb-3" />
      <Skeleton className="h-4 w-full max-w-2xl mb-2" />
      <Skeleton className="h-4 w-3/4 max-w-xl mb-5" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
            <Skeleton className="h-4 w-28 mb-2" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionControlsSkeleton() {
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-full sm:w-40 rounded-lg" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-8 w-24 rounded-full" />
        ))}
      </div>
    </div>
  );
}

export function QuestionCardsSkeleton() {
  return (
    <div role="status" aria-label="Loading questions" className="space-y-3">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4"
        >
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-4 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-3/4 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-5/6 mb-4" />
              <div className="flex flex-wrap gap-2 mb-4">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuestionsPageSkeleton() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <SectionHelpSkeleton />
      <QuestionControlsSkeleton />
      <QuestionCardsSkeleton />
    </main>
  );
}
