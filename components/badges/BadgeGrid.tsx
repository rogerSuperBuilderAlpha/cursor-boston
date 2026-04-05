import type { BadgeDefinition, BadgeEligibilityMap, BadgeId } from "@/lib/badges/types";
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
            ? "flex gap-4 overflow-x-auto pb-1 pr-2"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
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
              <div key={definition.id} className="min-w-[260px] shrink-0">
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
