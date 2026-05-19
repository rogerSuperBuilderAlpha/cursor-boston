/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { CheckCircle2, ExternalLink, Laptop, MessageCircle } from "lucide-react";

const ALC_URL = "https://ludwitt.com/alc";

interface SetupInstructionsPanelProps {
  /** Kickoff date headline, e.g. "Mon, May 11" / "Mon, Jun 29". */
  kickoffLabel: string;
}

export function SetupInstructionsPanel({
  kickoffLabel,
}: SetupInstructionsPanelProps) {
  return (
    <section
      role="tabpanel"
      id="tabpanel-setup"
      aria-labelledby="tab-setup"
      className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
          Before kickoff
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <Laptop className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
          Local machine
        </span>
      </div>
      <h2 className="mt-3 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Get your machine ready
      </h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        You&apos;ll be writing and shipping code from your laptop starting{" "}
        {kickoffLabel}. Three things have to be installed and working:
      </p>

      <ul className="mt-5 space-y-3 text-sm text-neutral-800 dark:text-neutral-200">
        <li className="flex gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Node.js (LTS)</p>
            <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">
              The runtime everything else builds on. Install the LTS version.
            </p>
          </div>
        </li>
        <li className="flex gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Git</p>
            <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">
              Install it and sign in with the GitHub account you connected on
              the My Info tab — your PRs need to come from the same identity.
            </p>
          </div>
        </li>
        <li className="flex gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Cursor (or Claude Code)</p>
            <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">
              Pick one. Cursor is recommended for cohort live work since the
              walkthroughs assume it, but Claude Code is fully fine if you
              already have a flow.
            </p>
          </div>
        </li>
      </ul>

      <a
        href={ALC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 sm:w-auto"
      >
        Open the full setup walkthrough
        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
      </a>

      <p className="mt-5 flex items-start gap-2 border-t border-neutral-200 pt-4 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        <MessageCircle
          className="mt-0.5 h-3.5 w-3.5 shrink-0"
          strokeWidth={2.25}
          aria-hidden="true"
        />
        <span>
          Hit a snag during install? Drop a question in the cohort Discord —
          someone is almost certainly already past it.
        </span>
      </p>
    </section>
  );
}
