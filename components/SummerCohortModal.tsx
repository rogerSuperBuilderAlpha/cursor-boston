/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  SUMMER_COHORTS,
  SUMMER_COHORT_LOCALSTORAGE_KEY,
  SUMMER_COHORT_OPEN_EVENT,
  SUMMER_COHORT_RETURN_TO,
} from "@/lib/summer-cohort";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SummerCohortModal() {
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const lastShown = localStorage.getItem(SUMMER_COHORT_LOCALSTORAGE_KEY);
      if (lastShown !== todayKey()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with localStorage on mount
        setIsOpen(true);
      }
    } catch {
      /* localStorage unavailable; skip auto-open */
    }
  }, []);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener(SUMMER_COHORT_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(SUMMER_COHORT_OPEN_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    try {
      localStorage.setItem(SUMMER_COHORT_LOCALSTORAGE_KEY, todayKey());
    } catch {
      /* ignore */
    }
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summer-cohort-title"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        ref={modalRef}
        className="relative bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl"
      >
        <button
          ref={closeButtonRef}
          onClick={handleClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Close summer cohort message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

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
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </div>

          <h2
            id="summer-cohort-title"
            className="text-2xl font-bold text-white mb-2"
          >
            Cursor Boston Summer Cohort
          </h2>
          <p className="text-neutral-400 mb-6">
            Two six-week sessions to build with Cursor alongside other Boston
            developers, founders, and students.
          </p>

          <ul className="space-y-2 mb-6 text-left">
            {SUMMER_COHORTS.map((cohort) => (
              <li
                key={cohort.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-neutral-800/60 border border-neutral-800"
              >
                <span className="text-sm font-semibold text-white">
                  {cohort.label}
                </span>
                <span className="text-xs text-neutral-300">
                  {cohort.startLabel} – {cohort.endLabel}
                </span>
              </li>
            ))}
          </ul>

          <Link
            href={SUMMER_COHORT_RETURN_TO}
            onClick={handleClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
          >
            Apply
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
          </Link>

          <button
            onClick={handleClose}
            className="mt-4 text-neutral-500 hover:text-neutral-300 text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
