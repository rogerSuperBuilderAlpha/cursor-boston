/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  GitPullRequest,
  Lightbulb,
  Swords,
} from "lucide-react";

const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";

export function GamePromoPanel() {
  return (
    <section
      role="tabpanel"
      id="tabpanel-game"
      aria-labelledby="tab-game"
      className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-purple-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
          For fun (and PRs)
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-400">
          <Swords className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
          /game
        </span>
      </div>
      <h2 className="mt-3 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        The Cursor Boston game
      </h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        A persistent web game we built into this same repo. Recruit, run
        threats, cast spells, climb the leaderboard. It&apos;s small and
        opinionated on purpose — and it&apos;s the easiest place in the
        codebase to ship something visible.
      </p>

      <Link
        href="/game"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-400 sm:w-auto"
      >
        Open /game
        <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
      </Link>

      <div className="mt-6 rounded-lg border-2 border-purple-300 bg-purple-50/50 p-5 dark:border-purple-800 dark:bg-purple-950/20">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">
          <Lightbulb className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          Help shape it
        </div>
        <h3 className="mt-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Have an idea? Open a PR.
        </h3>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          New spells, new threat types, balance tweaks, cleaner UI, a whole new
          game mode — anything goes. The PR fast-lane that got most of you
          admitted is still active, and contributions to <code>/game</code> are
          exactly the kind of work we want to see.
        </p>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
          <li className="flex gap-2">
            <span className="text-neutral-400" aria-hidden="true">•</span>
            <span>
              Game logic lives under <code>lib/game/</code>; UI is under{" "}
              <code>app/game/</code>.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-neutral-400" aria-hidden="true">•</span>
            <span>
              Pick something small for your first PR — a new spell or a tile
              tweak ships in an afternoon.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-neutral-400" aria-hidden="true">•</span>
            <span>
              Wild ideas welcome. Open an issue first if you want a sanity
              check before you build.
            </span>
          </li>
        </ul>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-purple-400 bg-white px-4 py-2.5 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50 dark:border-purple-700 dark:bg-neutral-900 dark:text-purple-300 dark:hover:bg-purple-950/40"
        >
          <GitPullRequest className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          Open the repo on GitHub
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
