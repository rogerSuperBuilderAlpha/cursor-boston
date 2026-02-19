"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Skeleton that mirrors the MemberCard layout for a smooth loading transition.
 */
export function MemberCardSkeleton() {
  return (
    <div
      className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800"
      aria-hidden="true"
    >
      {/* Header: avatar + name/job */}
      <div className="flex items-start gap-4 mb-4">
        <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      {/* Bio lines */}
      <div className="space-y-2 mb-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      {/* Location */}
      <Skeleton className="h-4 w-28 mb-4" />
      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      {/* Social links bar */}
      <div className="flex items-center gap-1 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <Skeleton className="h-10 w-10 rounded" />
        <Skeleton className="h-10 w-10 rounded" />
        <Skeleton className="h-10 w-10 rounded" />
      </div>
    </div>
  );
}
