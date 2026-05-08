/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";

export function RecruitLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
    </div>
  );
}

export function RecruitSignInScreen() {
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

export function RecruitEnlistScreen() {
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
