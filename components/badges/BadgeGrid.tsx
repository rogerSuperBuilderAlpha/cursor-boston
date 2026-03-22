import type { BadgeDefinition, BadgeEligibilityMap, BadgeId } from "@/lib/badges/types";
import { cn } from "@/lib/utils";
import { BadgeCard } from "./BadgeCard";

interface BadgeGridProps {
  definitions: BadgeDefinition[];
  eligibilityMap?: BadgeEligibilityMap;
  earnedBadgeIds?: BadgeId[];
  compact?: boolean;
  className?: string;
}

export function BadgeGrid({
  definitions,
  eligibilityMap,
  earnedBadgeIds,
  compact = false,
  className,
}: BadgeGridProps) {
  return (
    <section className={cn(className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {definitions.map((definition) => {
          const eligibility = eligibilityMap?.[definition.id];
          const earned = earnedBadgeIds
            ? earnedBadgeIds.includes(definition.id)
            : undefined;

          return (
            <BadgeCard
              key={definition.id}
              definition={definition}
              eligibility={eligibility}
              earned={earned}
              compact={compact}
            />
          );
        })}
      </div>
    </section>
  );
}
