/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { BadgeDefinition, BadgeEligibilityMap, BadgeId } from "@/lib/badges/types";
import { TAILWIND_CLASS_NAMES as TW } from "@/lib/classname-constants";
import { cn } from "@/lib/utils";
import { BadgeCard } from "./BadgeCard";

interface BadgeGridProps {
  definitions: BadgeDefinition[];
  eligibilityMap?: BadgeEligibilityMap;
  earnedBadgeIds?: BadgeId[];
  userBadgeMap?: Partial<Record<BadgeId, { awardedAt?: string }>>;
  isAuthoritative?: boolean;
  compact?: boolean;
  layout?: "grid" | "horizontal";
  className?: string;
}

export function BadgeGrid({
  definitions,
  eligibilityMap,
  earnedBadgeIds,
  userBadgeMap,
  isAuthoritative = true,
  compact = false,
  layout = "grid",
  className,
}: BadgeGridProps) {
  const isHorizontal = layout === "horizontal";

  return (
    <section className={cn(className)}>
      <div
        className={cn(
          isHorizontal
            ? cn(TW.layout.flex, TW.spacing.gap4, "overflow-x-auto pb-1 pr-2")
            : cn(TW.layout.grid, "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", TW.spacing.gap4)
        )}
      >
        {definitions.map((definition) => {
          const eligibility = eligibilityMap?.[definition.id];
          const earned = earnedBadgeIds
            ? earnedBadgeIds.includes(definition.id)
            : undefined;

          const card = (
            <BadgeCard
              key={definition.id}
              definition={definition}
              eligibility={eligibility}
              earned={earned}
              awardedAt={userBadgeMap?.[definition.id]?.awardedAt}
              isAuthoritative={isAuthoritative}
              compact={compact}
            />
          );

          if (isHorizontal) {
            return (
              <div key={definition.id} className={cn("min-w-[260px]", TW.layout.shrink0)}>
                {card}
              </div>
            );
          }

          return card;
        })}
      </div>
    </section>
  );
}
