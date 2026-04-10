/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { cn } from "@/lib/utils";


interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional className for the skeleton base */
  className?: string;
}

/**
 * Base Skeleton component for loading states.
 * Uses animate-pulse for a subtle shimmer effect that improves perceived performance
 * over spinners. Replace with content-shaped skeletons for best UX.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800", className)}
      aria-hidden="true"
      {...props}
    />
  );
}
