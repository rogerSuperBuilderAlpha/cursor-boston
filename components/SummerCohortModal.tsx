/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DiscordIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import {
  SUMMER_COHORT_LOCALSTORAGE_KEY,
  SUMMER_COHORT_OPEN_EVENT,
} from "@/lib/summer-cohort";

const EVENT_SLUG = "cursor-boston-hult-summer-hackathon-2026";
const EVENT_HREF = `/events/${EVENT_SLUG}`;
const LUMA_URL = "https://luma.com/s5wuujzl";
const WHEN_LABEL = "Monday, August 24";
const TIME_LABEL = "1:00 – 5:00 PM ET";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Pages that already cover the modal's content — don't auto-pop on top of
// them. Manual dispatch of SUMMER_COHORT_OPEN_EVENT still works.
const SUPPRESS_AUTO_OPEN_PREFIXES = [
  "/contribute/game-art",
  "/login",
  "/signup",
  EVENT_HREF,
];

export default function SummerCohortModal() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let lastShown: string | null = null;
    try {
      lastShown = localStorage.getItem(SUMMER_COHORT_LOCALSTORAGE_KEY);
    } catch {
      return;
    }
    if (lastShown === todayKey()) return;
    if (
      pathname &&
      SUPPRESS_AUTO_OPEN_PREFIXES.some((p) => pathname.startsWith(p))
    ) {
      return;
    }
    // Defer so auto-open is not a synchronous setState in the effect body
    // (react-hooks/set-state-in-effect). localStorage cannot seed useState
    // without a client-only pass.
    const frame = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener(SUMMER_COHORT_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(SUMMER_COHORT_OPEN_EVENT, handleOpen);
  }, []);

  const handleClose = useCallback(() => {
    try {
      localStorage.setItem(SUMMER_COHORT_LOCALSTORAGE_KEY, todayKey());
    } catch {
      /* ignore */
    }
    setIsOpen(false);
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      titleId="monday-event-title"
      closeButtonLabel="Close Monday event announcement"
    >
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-emerald-400"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>

        <p className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-2">
          This Monday
        </p>
        <h2 id="monday-event-title" className="text-2xl font-bold text-white mb-3">
          Cursor Boston × Hult Summer Hackathon
        </h2>
        <p className="text-neutral-400 mb-5">
          Close out summer in person at{" "}
          <span className="text-neutral-200 font-medium">
            Hult International Business School
          </span>
          . Pizza, an afternoon of building, presentations, and a conversation
          with Shiv Jethi from the Cursor team. Free and open to the whole
          community.
        </p>

        <div className="mb-6 px-4 py-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
          <span className="block text-xs uppercase tracking-wide text-emerald-300 font-semibold">
            Sign up for Monday
          </span>
          <span className="block text-lg font-bold text-white">{WHEN_LABEL}</span>
          <span className="block text-sm text-neutral-300 mt-1">
            {TIME_LABEL} · 1 Education St, Cambridge
          </span>
        </div>

        <a
          href={LUMA_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClose}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
        >
          RSVP on Luma
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </a>
        <p className="mt-3 text-xs text-neutral-400">
          Luma will ask for your GitHub profile.{" "}
          <Link
            href={EVENT_HREF}
            onClick={handleClose}
            className="font-semibold text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline"
          >
            Event details
          </Link>
        </p>

        <div className="mt-6 pt-5 border-t border-neutral-800">
          <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-3 text-left">
            Or just explore the community
          </p>
          <div className="grid grid-cols-3 gap-2">
            <a
              href="https://discord.gg/Wsncg8YYqc"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-lg border border-neutral-800 bg-neutral-800/30 hover:bg-neutral-800/60 hover:border-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]"
            >
              <DiscordIcon size={18} className="text-[#7983f5]" />
              <span className="text-xs font-medium text-neutral-200">Discord</span>
            </a>
            <Link
              href="/events"
              onClick={handleClose}
              className="flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-lg border border-neutral-800 bg-neutral-800/30 hover:bg-neutral-800/60 hover:border-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
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
                className="text-neutral-300"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="text-xs font-medium text-neutral-200">Events</span>
            </Link>
            <Link
              href="/pr-ideas"
              onClick={handleClose}
              className="flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-lg border border-neutral-800 bg-neutral-800/30 hover:bg-neutral-800/60 hover:border-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
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
                className="text-neutral-300"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <path d="M9 9h6v6H9z" />
              </svg>
              <span className="text-xs font-medium text-neutral-200">PR Ideas</span>
            </Link>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="mt-4 text-neutral-500 hover:text-neutral-300 text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline"
        >
          Maybe later
        </button>
      </div>
    </Modal>
  );
}
