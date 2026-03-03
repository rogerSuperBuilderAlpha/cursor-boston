"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Skeleton that mirrors the login/signup form layout during auth state check.
 */
export function AuthFormSkeleton() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 md:px-6 py-8 md:py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 md:mb-8">
          <Skeleton className="h-9 w-48 mx-auto mb-2" />
          <Skeleton className="h-5 w-64 mx-auto" />
        </div>
        <div className="bg-neutral-900 rounded-xl md:rounded-2xl p-5 md:p-8 border border-neutral-800">
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          <div className="mt-6 flex gap-3">
            <Skeleton className="h-11 flex-1 rounded-lg" />
            <Skeleton className="h-11 flex-1 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
