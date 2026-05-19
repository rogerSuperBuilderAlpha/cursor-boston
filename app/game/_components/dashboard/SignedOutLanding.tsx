/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";

/** Landing screen rendered when no user is signed in. */
export function SignedOutLanding() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-3xl font-bold mb-4">Generals</h1>
        <p className="text-neutral-600 dark:text-neutral-300 mb-3">
          A turn-based strategy game for the cursor-boston community. Sign in,
          claim a starting cluster of lands, and push outward into the world.
        </p>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">
          <strong>The catch:</strong> turns are gated by PR merges. Merge a PR
          into this repo any time during a week and you&apos;ll receive 100
          turns the following Sunday at midnight EST. No PR, no turns.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/game/help"
            className="inline-block px-6 py-3 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            How to play
          </Link>
        </div>
      </div>
    </div>
  );
}
