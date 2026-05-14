/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";

export function SpellsLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
    </div>
  );
}

export function SpellsSignInScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Link
        href="/login"
        className="px-6 py-3 bg-emerald-500 text-white rounded-lg"
      >
        Sign in
      </Link>
    </div>
  );
}

export function SpellsEnlistScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Link
        href="/game"
        className="px-6 py-3 bg-emerald-500 text-white rounded-lg"
      >
        Enlist first
      </Link>
    </div>
  );
}

export function CasteRequiredScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Choose a caste before you can browse your spell book — each caste has
          its own three spells.
        </p>
        <Link
          href="/game/setup"
          className="px-6 py-3 bg-emerald-500 text-white rounded-lg"
        >
          Continue setup →
        </Link>
      </div>
    </div>
  );
}
