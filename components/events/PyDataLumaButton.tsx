/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PYDATA_2026_LUMA_URL } from "@/lib/pydata-2026";

type Variant = "primary" | "outline" | "inline";

type Props = {
  /** Visual style. Defaults to outline (the most common usage). */
  variant?: Variant;
  /** Override label; defaults match each variant. */
  label?: string;
  className?: string;
};

const STATUS_PATH = "/api/events/pydata-2026/luma-status";

/**
 * Renders a "Register on Luma" link only when the viewer is signed in and
 * NOT already on the PyData Luma list. The site registration is the
 * primary path for door access; this is the secondary nudge for the
 * minority who skipped Luma.
 *
 * Returns null in all other cases (signed-out, on-list, errored). That
 * keeps the default UX uncluttered with the now-misleading Luma button.
 */
export function PyDataLumaButton({
  variant = "outline",
  label,
  className = "",
}: Props) {
  const { user, loading: authLoading } = useAuth();
  const [onLumaList, setOnLumaList] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot reset on sign-out
      setOnLumaList(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(STATUS_PATH, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) setOnLumaList(true); // fail closed: hide the button
          return;
        }
        const json = (await res.json()) as { onLumaList?: boolean };
        if (!cancelled) setOnLumaList(Boolean(json.onLumaList));
      } catch {
        if (!cancelled) setOnLumaList(true); // fail closed
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading) return null;
  if (!user) return null;
  if (onLumaList === null) return null; // status not yet known
  if (onLumaList) return null;

  const text = label ?? "Also RSVP on Luma";

  if (variant === "inline") {
    return (
      <a
        href={PYDATA_2026_LUMA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={
          className ||
          "text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400"
        }
      >
        {text}
      </a>
    );
  }

  if (variant === "primary") {
    return (
      <a
        href={PYDATA_2026_LUMA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={
          className ||
          "inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-emerald-500 text-white rounded-lg text-base font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black w-full sm:w-auto"
        }
      >
        {text}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 17l9.2-9.2M17 17V7H7" />
        </svg>
      </a>
    );
  }

  return (
    <a
      href={PYDATA_2026_LUMA_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ||
        "inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-neutral-300 dark:border-neutral-700 text-foreground rounded-lg text-sm font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white"
      }
    >
      {text}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 17l9.2-9.2M17 17V7H7" />
      </svg>
    </a>
  );
}
