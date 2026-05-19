/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { TabBar } from "./_components/TabBar";
import { CastesTab } from "./_components/tabs/CastesTab";
import { CombatTab } from "./_components/tabs/CombatTab";
import { CommunityTab } from "./_components/tabs/CommunityTab";
import { ContributorTab } from "./_components/tabs/ContributorTab";
import { EndgameTab } from "./_components/tabs/EndgameTab";
import { HeroesTab } from "./_components/tabs/HeroesTab";
import { OverviewTab } from "./_components/tabs/OverviewTab";
import { PhasesTab } from "./_components/tabs/PhasesTab";
import { WorldTab } from "./_components/tabs/WorldTab";
import { resolveTabId, type TabId } from "./_lib/tabs";

function HelpPageInner() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active: TabId = resolveTabId(search?.get("tab"));

  const setTab = (id: TabId) => {
    const params = new URLSearchParams(Array.from(search?.entries() ?? []));
    params.set("tab", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">Generals — How to play</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <p className="text-neutral-600 dark:text-neutral-300 mb-6 leading-relaxed">
          Generals is a slow, persistent, turn-based strategy game shared by
          the whole cursor-boston community. Read whichever tab fits where you
          are: new players start with <strong>Overview</strong>; long-time
          players head for <strong>Combat</strong>, <strong>Heroes</strong>,
          <strong> Endgame</strong>, and <strong>Community</strong>.
        </p>

        <TabBar active={active} onChange={setTab} />

        {active === "overview" && <OverviewTab />}
        {active === "phases" && <PhasesTab />}
        {active === "castes" && <CastesTab />}
        {active === "combat" && <CombatTab />}
        {active === "heroes" && <HeroesTab />}
        {active === "endgame" && <EndgameTab />}
        {active === "community" && <CommunityTab />}
        {active === "world" && <WorldTab />}
        {active === "contributor" && <ContributorTab />}

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/game"
            className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
          >
            ← Back to dashboard
          </Link>
          <Link
            href="/game/leaderboard"
            className="px-5 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function GameHelpPage() {
  return (
    <Suspense fallback={null}>
      <HelpPageInner />
    </Suspense>
  );
}
