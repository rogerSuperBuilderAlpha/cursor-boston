/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";

export function SetupLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
    </div>
  );
}

export function SetupSignInScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Link
        href="/login"
        className="px-6 py-3 bg-emerald-500 text-white rounded-lg"
      >
        Sign in to begin
      </Link>
    </div>
  );
}

export function SetupEnlistScreen() {
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

export function SetupCompleteScreen({ caste }: { caste: string | null }) {
  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-bold mb-2">Setup complete</h2>
      <p className="text-neutral-600 dark:text-neutral-300 mb-6">
        Caste locked: <strong className="capitalize">{caste}</strong>. Combat
        and spells arrive in PR 3.
      </p>
      <Link
        href="/game"
        className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
