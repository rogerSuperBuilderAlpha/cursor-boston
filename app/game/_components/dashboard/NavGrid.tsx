/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import type { GamePlayer } from "@/lib/game/types";

interface NavGridProps {
  phase: GamePlayer["phase"];
}

interface NavItem {
  href: string;
  label: string;
  primary?: boolean;
}

interface NavGroupProps {
  label: string;
  items: NavItem[];
}

function NavGroup({ label, items }: NavGroupProps) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1.5">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={
              it.primary
                ? "px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors text-sm"
                : "px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-sm"
            }
          >
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Two-row navigation grid below the cards. The "Take action" row pivots
 * on phase: setup phases hide combat-only links so the user isn't
 * tempted to click into pages that won't do anything.
 */
export function NavGrid({ phase }: NavGridProps) {
  const inSetup = phase !== "play";
  return (
    <div className="space-y-3">
      <NavGroup
        label="Take action"
        items={
          inSetup
            ? [
                { href: "/game/setup", label: "Continue setup", primary: true },
                { href: "/game/tiles", label: "World map" },
              ]
            : [
                { href: "/game/threats", label: "Threats", primary: true },
                { href: "/game/tiles", label: "World map" },
                { href: "/game/recruit", label: "Recruit" },
                { href: "/game/spells", label: "Spells" },
                { href: "/game/upgrades", label: "Upgrades" },
                { href: "/game/artifacts", label: "Artifacts" },
                { href: "/game/attacks", label: "Attack log" },
              ]
        }
      />
      <NavGroup
        label="Reference"
        items={[
          { href: "/game/leaderboard", label: "Leaderboard" },
          { href: "/game/help", label: "Help & Lore" },
        ]}
      />
    </div>
  );
}
