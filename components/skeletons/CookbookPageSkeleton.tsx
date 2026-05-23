/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { Skeleton } from "@/components/ui/Skeleton";

function CookbookHeroSkeleton() {
  return (
    <section className="py-16 md:py-24 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-gradient-to-b from-transparent via-neutral-50/50 dark:via-neutral-950/30 to-transparent">
      <div className="max-w-4xl mx-auto text-center">
        <Skeleton className="h-7 w-40 mx-auto mb-6 rounded-full" />
        <Skeleton className="h-12 w-full max-w-xl mx-auto mb-6" />
        <Skeleton className="h-5 w-full max-w-2xl mx-auto mb-2" />
        <Skeleton className="h-5 w-3/4 max-w-xl mx-auto" />
      </div>
    </section>
  );
}

function CookbookHelpSkeleton() {
  return (
    <div className="px-6 py-6 max-w-4xl mx-auto w-full">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
        <Skeleton className="h-6 w-52 mb-3" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-4/5 mb-5" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SubmitPanelSkeleton() {
  return (
    <section className="px-6 py-10 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 md:p-8">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-7 w-56 mb-2" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <Skeleton className="h-6 w-6 shrink-0" />
          </div>
        </div>
      </div>
    </section>
  );
}

function CookbookFiltersSkeleton() {
  return (
    <aside className="lg:w-56 shrink-0">
      <div className="sticky top-24 space-y-6 p-5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        {[1, 2, 3].map((item) => (
          <div key={item}>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </aside>
  );
}

export function CookbookEntryCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading cookbook entries"
      className="grid sm:grid-cols-2 gap-6"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5"
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-6 w-4/5 mb-3" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6 mb-5" />
          <div className="flex flex-wrap gap-2 mb-5">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CookbookPageSkeleton() {
  return (
    <div className="flex flex-col">
      <CookbookHeroSkeleton />
      <CookbookHelpSkeleton />
      <SubmitPanelSkeleton />
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
          <CookbookFiltersSkeleton />
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div className="space-y-2">
                <Skeleton className="h-9 w-56" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-10 w-40 rounded-lg" />
            </div>
            <CookbookEntryCardsSkeleton />
          </div>
        </div>
      </section>
    </div>
  );
}
