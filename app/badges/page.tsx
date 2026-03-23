"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getBadgeEligibilityInput } from "@/lib/badges/getBadgeEligibilityInput";
import { evaluateBadgeEligibility } from "@/lib/badges/eligibility";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";
import type { BadgeEligibilityMap } from "@/lib/badges/types";
import { BadgeGrid } from "@/components/badges/BadgeGrid";

export default function BadgesPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [eligibilityMap, setEligibilityMap] = useState<BadgeEligibilityMap | undefined>(undefined);
  const [loadingBadges, setLoadingBadges] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/badges");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) {
      setEligibilityMap(undefined);
      return;
    }

    setLoadingBadges(true);
    (async () => {
      try {
        const input = await getBadgeEligibilityInput({
          uid: user.uid,
          displayName: userProfile?.displayName ?? user.displayName ?? null,
          visibility: userProfile?.visibility ?? null,
          discord: userProfile?.discord,
          github: userProfile?.github,
        });
        setEligibilityMap(evaluateBadgeEligibility(input));
      } catch (err) {
        console.error("Error loading badge eligibility:", err);
        setEligibilityMap(evaluateBadgeEligibility({}));
      } finally {
        setLoadingBadges(false);
      }
    })();
  }, [user, userProfile]);

  if (loading || !user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neutral-900 dark:border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] px-6 py-8 md:py-12">
      <div className="max-w-6xl mx-auto">
        <section className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Achievement Badges</h1>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl">
            Track your milestones across profile completion, community participation, events, and contributions.
          </p>
        </section>

        <section className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Your Progress</h2>
            {loadingBadges && <span className="text-xs text-neutral-400">Updating...</span>}
          </div>

          <BadgeGrid
            definitions={BADGE_DEFINITIONS}
            eligibilityMap={eligibilityMap}
          />
        </section>
      </div>
    </div>
  );
}
