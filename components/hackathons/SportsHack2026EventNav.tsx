/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  SPORTS_HACK_2026_EVENT_ID,
  SPORTS_HACK_2026_SHORT_NAME,
} from "@/lib/sports-hack-2026";

/**
 * Shared cross-page navigation for the May 26 Sports Hack 2026 event.
 *
 * The event spans four distinct routes (overview, signup leaderboard,
 * admin door check-in, and the public submissions list under `/events/`).
 * Before this component the only way to move between them was the back
 * button or breadcrumbs. This nav surfaces all four with active-state
 * highlighting on the current page.
 *
 * Admin link is hidden unless `userProfile.isAdmin === true`.
 */

const SUBMISSIONS_HREF = "/events/cursor-boston-sports-hack-2026";
const OVERVIEW_HREF = `/hackathons/${SPORTS_HACK_2026_EVENT_ID}`;
const SIGNUP_HREF = `/hackathons/${SPORTS_HACK_2026_EVENT_ID}/signup`;
const ADMIN_HREF = `/hackathons/${SPORTS_HACK_2026_EVENT_ID}/admin`;

type NavLink = {
  href: string;
  label: string;
  requiresAdmin?: boolean;
};

const NAV_LINKS: readonly NavLink[] = [
  { href: OVERVIEW_HREF, label: "Overview" },
  { href: SIGNUP_HREF, label: "Sign up & rank" },
  { href: SUBMISSIONS_HREF, label: "Submissions" },
  { href: ADMIN_HREF, label: "Admin", requiresAdmin: true },
] as const;

export function SportsHack2026EventNav() {
  const pathname = usePathname() ?? "";
  const { userProfile } = useAuth();
  const isAdmin = Boolean(
    (userProfile as { isAdmin?: boolean } | null)?.isAdmin
  );

  const links = NAV_LINKS.filter(
    (link) => !link.requiresAdmin || isAdmin
  );

  return (
    <nav
      aria-label="Sports Hack 2026 event"
      className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm dark:bg-emerald-500/10"
    >
      <Link
        href={OVERVIEW_HREF}
        className="font-semibold text-foreground hover:text-emerald-700 dark:hover:text-emerald-300"
      >
        {SPORTS_HACK_2026_SHORT_NAME} · May 26
      </Link>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "border-b-2 border-emerald-500 pb-0.5 font-semibold text-emerald-700 dark:text-emerald-300"
                    : "text-neutral-600 hover:text-foreground dark:text-neutral-400"
                }
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
