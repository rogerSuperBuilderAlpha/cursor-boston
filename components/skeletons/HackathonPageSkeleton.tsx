"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Skeleton for hackathon pool/teams pages during data loading.
 */
export function HackathonPageSkeleton() {
  return (
    <div className="min-h-[60vh] flex flex-col">
      <div className="max-w-6xl mx-auto px-6 py-10 w-full">
        <div className="mb-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64 mt-1" />
        </div>
        <Skeleton className="h-14 w-full rounded-lg mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
