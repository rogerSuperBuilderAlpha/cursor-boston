"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { MemberCardSkeleton } from "./MemberCardSkeleton";

/**
 * Skeleton for the Members/Community page during Suspense loading.
 * Mirrors the hero + tabs + content grid layout.
 */
export function MembersPageSkeleton() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <Skeleton className="h-12 w-48 mx-auto mb-4" />
          <Skeleton className="h-6 w-96 mx-auto mb-8" />
          {/* Tabs */}
          <div className="flex justify-center gap-2">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>
      </section>

      {/* Content area - member grid skeleton */}
      <section className="py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <MemberCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
