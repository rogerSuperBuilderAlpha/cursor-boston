/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { ReactNode } from "react";
import Link from "next/link";

/**
 * Admin shell. Per-page auth gates run client-side via useAuth() so that
 * non-admins are redirected before the page renders any content. The
 * `users.isAdmin` claim is server-authoritative and rules-enforced — see
 * `lib/server-auth.ts:hasAdminClaim`.
 *
 * This layout is intentionally minimal: a header bar with admin-page
 * links, then the page body. Admin pages are not user-facing and don't
 * inherit the marketing chrome.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-lg font-semibold">
              Admin
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-400">
              <Link href="/admin/moderation" className="hover:text-white">
                Moderation
              </Link>
              <Link href="/admin/summer-cohort" className="hover:text-white">
                Summer cohort
              </Link>
            </nav>
          </div>
          <Link href="/" className="text-sm text-zinc-400 hover:text-white">
            ← Back to site
          </Link>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
