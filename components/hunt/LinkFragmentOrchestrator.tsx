/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useToast } from "@/components/Toast";
import {
  readStoredFragments,
  writeStoredFragment,
} from "@/components/hunt/link-fragment-storage";

const LOGO_CLICK_TARGET = 7;
const LOGO_CLICK_WINDOW_MS = 4000;

async function verifyPuzzle(puzzleId: string, answer: string) {
  const res = await fetch("/api/hunt/link-fragment/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ puzzleId, answer }),
  });
  return (await res.json()) as {
    ok?: boolean;
    reason?: string;
    puzzleId?: string;
    fragment?: string;
    index?: number;
    token?: string;
  };
}

/**
 * Sitewide listener for interaction-based link-fragment puzzles (e.g. home logo taps).
 */
export function LinkFragmentOrchestrator() {
  const pathname = usePathname();
  const { success } = useToast();
  const clickTimes = useRef<number[]>([]);
  const unlocking = useRef(false);

  const unlockHomePulse = useCallback(async () => {
    if (unlocking.current) return;
    const already = readStoredFragments().some((f) => f.puzzleId === "home-pulse");
    if (already) return;

    unlocking.current = true;
    try {
      const j = await verifyPuzzle("home-pulse", "seven-beats");
      if (j.ok && j.token && j.fragment && typeof j.index === "number") {
        writeStoredFragment({
          puzzleId: "home-pulse",
          fragment: j.fragment,
          token: j.token,
          index: j.index,
        });
        success({
          title: `Fragment ${j.index + 1} unlocked: ${j.fragment}`,
        });
      }
    } finally {
      unlocking.current = false;
    }
  }, [success]);

  useEffect(() => {
    if (pathname !== "/") return;

    function onLogoClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const img = target.closest('img[alt="Cursor Boston"]');
      if (!img) return;

      const now = Date.now();
      clickTimes.current = clickTimes.current
        .filter((t) => now - t < LOGO_CLICK_WINDOW_MS)
        .concat(now);

      if (clickTimes.current.length >= LOGO_CLICK_TARGET) {
        clickTimes.current = [];
        void unlockHomePulse();
      }
    }

    document.addEventListener("click", onLogoClick);
    return () => document.removeEventListener("click", onLogoClick);
  }, [pathname, unlockHomePulse]);

  return null;
}
