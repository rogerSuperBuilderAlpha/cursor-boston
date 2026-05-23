/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import type { BadgeDefinition, BadgeEligibilityResult } from "@/lib/badges/types";
import { CLASS_GROUPS, TAILWIND_CLASS_NAMES as TW } from "@/lib/classname-constants";
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
      className={cn("fixed z-50", TW.layout.inset0, TW.layout.flex, TW.layout.itemsCenter, TW.layout.justifyCenter, TW.spacing.p4)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-label={anchorLabel || `${definition.name} details`}
    >
      <button
        type="button"
        className={cn(TW.layout.absolute, TW.layout.inset0, TW.surface.overlay)}
        aria-label="Close"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        className={cn(TW.layout.relative, TW.layout.wFull, "max-w-sm shadow-xl", CLASS_GROUPS.card.neutral)}
      >
        <div className={cn(TW.layout.flex, TW.layout.itemsStart, TW.layout.justifyBetween, TW.spacing.gap3, TW.spacing.p4, TW.border.bottomNeutral)}>
          <div className="min-w-0">
            <h3 id={headingId} className={cn("text-base", TW.text.semibold, TW.text.foreground, TW.layout.truncate)}>
              {definition.name}
            </h3>
            <p className={cn(TW.text.tiny, TW.text.subtle, TW.spacing.mt1)}>
              {anchorLabel || "Achievement badge"}
            </p>
          </div>
          <span
            className={cn(
              CLASS_GROUPS.badge.basePill,
              isEarned ? CLASS_GROUPS.badge.earnedPill : CLASS_GROUPS.badge.lockedPill
            )}
          >
            {isEarned ? "Earned" : "Locked"}
          </span>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <p className={cn(CLASS_GROUPS.text.sectionLabel, TW.spacing.mb1)}>
              Description
            </p>
            <p className={CLASS_GROUPS.text.body}>
              {definition.description}
            </p>
          </div>

          <div>
            <p className={cn(CLASS_GROUPS.text.sectionLabel, TW.spacing.mb1)}>
              How to earn
            </p>
            <p className={CLASS_GROUPS.text.body}>
              {definition.howToEarn}
            </p>
          </div>

          {eligibility?.progress && (
            <div>
              <p className={cn(CLASS_GROUPS.text.sectionLabel, TW.spacing.mb1)}>
                Progress
              </p>
              <p className={cn(CLASS_GROUPS.text.body, TW.spacing.mb2)}>
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
              <p className={cn(CLASS_GROUPS.text.sectionLabel, TW.spacing.mb1)}>
                Next step
              </p>
              <p className={CLASS_GROUPS.text.body}>
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
            className={cn(TW.layout.wFull, TW.spacing.px3, TW.spacing.py2, TW.radius.lg, CLASS_GROUPS.button.neutral, TW.text.sm, TW.text.medium)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
