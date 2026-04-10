/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import type { BadgeDefinition, BadgeEligibilityResult } from "@/lib/badges/types";
import { cn } from "@/lib/utils";

interface BadgePopoverProps {
  definition: BadgeDefinition;
  eligibility?: BadgeEligibilityResult;
  isOpen: boolean;
  onClose: () => void;
  anchorLabel?: string;
  showcaseApprovalNote?: string;
}

export function BadgePopover({
  definition,
  eligibility,
  isOpen,
  onClose,
  anchorLabel,
  showcaseApprovalNote,
}: BadgePopoverProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const container = dialogRef.current;
      if (!container) return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isEarned = eligibility?.isEligible ?? false;
  const headingId = `badge-popover-title-${definition.id}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-label={anchorLabel || `${definition.name} details`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        className="relative w-full max-w-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="min-w-0">
            <h3 id={headingId} className="text-base font-semibold text-foreground truncate">
              {definition.name}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {anchorLabel || "Achievement badge"}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 px-2 py-0.5 rounded-full text-xs font-medium",
              isEarned
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
            )}
          >
            {isEarned ? "Earned" : "Locked"}
          </span>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
              Description
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              {definition.description}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
              How to earn
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              {definition.howToEarn}
            </p>
          </div>

          {eligibility?.progress && (
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                Progress
              </p>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                {eligibility.progress.current}/{eligibility.progress.target}
                {eligibility.progress.unit ? ` ${eligibility.progress.unit}` : ""}
              </p>
              <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    isEarned ? "bg-emerald-500" : "bg-neutral-500 dark:bg-neutral-500"
                  )}
                  style={{
                    width: `${Math.min(
                      100,
                      (eligibility.progress.current / eligibility.progress.target) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {!isEarned && eligibility?.reason && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 p-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                Next step
              </p>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                {eligibility.reason}
              </p>
            </div>
          )}

          {showcaseApprovalNote && (
            <div className="rounded-lg border border-emerald-300/40 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">
                Verification
              </p>
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                {showcaseApprovalNote}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 pt-0">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="w-full px-3 py-2 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
