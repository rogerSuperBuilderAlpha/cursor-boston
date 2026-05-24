/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

/**
 * Minimal in-house toast system.
 *
 * Why not a library: the entire surface we need is "fire-and-forget
 * notification with a tiny CTA inside". Adding sonner / react-hot-toast
 * for that is a 5-15KB tax on every page load, and we want this to
 * eventually live behind a feature flag for a11y testing — easier on a
 * surface we own.
 *
 * Accessibility: the Toaster mounts inside an `aria-live` region so
 * screen readers announce errors as they appear. Severity → role:
 *  - error      → role="alert"      (announced assertively)
 *  - success/info → role="status"   (announced politely)
 *
 * Failure-class toasts (`error`) automatically get a "If this looks
 * broken, fork the repo and send a fix" footer link. That's a project
 * policy decision (see CLAUDE.md) — every visible failure should give
 * the user a concrete path to help fix it.
 */

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";
const REPO_FORK_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston/fork";
const DEFAULT_DURATION_MS = 8_000;
const ERROR_DURATION_MS = 12_000; // errors get longer so users can read the fix-link

export type ToastSeverity = "error" | "success" | "info";

export interface ToastOptions {
  /** Title line — short, action-oriented. */
  title: string;
  /** Optional explanatory body. Errors should always include this. */
  description?: string;
  /** Defaults to "info". */
  severity?: ToastSeverity;
  /** Auto-dismiss timeout (ms). null disables auto-dismiss. */
  durationMs?: number | null;
}

interface ToastEntry extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  /** Shorthand for `toast({ severity: "error", ... })`. */
  error: (options: Omit<ToastOptions, "severity">) => void;
  /** Shorthand for `toast({ severity: "success", ... })`. */
  success: (options: Omit<ToastOptions, "severity">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entry: ToastEntry = { ...options, id };
    setToasts((current) => [...current, entry]);
  }, []);

  const error = useCallback(
    (options: Omit<ToastOptions, "severity">) =>
      toast({ ...options, severity: "error" }),
    [toast]
  );
  const success = useCallback(
    (options: Omit<ToastOptions, "severity">) =>
      toast({ ...options, severity: "success" }),
    [toast]
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toast, error, success, dismiss }),
    [toast, error, success, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

interface ToasterProps {
  toasts: ToastEntry[];
  onDismiss: (id: string) => void;
}

function Toaster({ toasts, onDismiss }: ToasterProps) {
  // Two stacked live regions so SR announcement priority matches severity
  // (assertive for errors, polite for success/info). Both are visually
  // identical and share the bottom-right column.
  const errors = toasts.filter((t) => t.severity === "error");
  const other = toasts.filter((t) => t.severity !== "error");
  return (
    <>
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-[min(420px,calc(100vw-2rem))] flex-col gap-2"
        aria-live="assertive"
        aria-atomic="false"
        role="region"
        aria-label="Error notifications"
      >
        {errors.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[99] mt-12 flex max-w-[min(420px,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
        role="region"
        aria-label="Notifications"
        style={{
          // Stack below the error region without overlapping; height-driven.
          transform: `translateY(${errors.length * 88}px)`,
        }}
      >
        {other.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastEntry;
  onDismiss: (id: string) => void;
}) {
  const severity: ToastSeverity = toast.severity ?? "info";
  const durationMs =
    toast.durationMs === null
      ? null
      : toast.durationMs ??
        (severity === "error" ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);

  useEffect(() => {
    if (durationMs === null) return;
    const handle = setTimeout(() => onDismiss(toast.id), durationMs);
    return () => clearTimeout(handle);
  }, [durationMs, onDismiss, toast.id]);

  const accent =
    severity === "error"
      ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-100"
      : severity === "success"
        ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
        : "border-neutral-300 bg-neutral-50 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950/80 dark:text-neutral-100";

  return (
    <div
      role={severity === "error" ? "alert" : "status"}
      className={`pointer-events-auto rounded-lg border ${accent} shadow-lg backdrop-blur px-4 py-3`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{toast.title}</div>
          {toast.description && (
            <div className="mt-1 text-sm opacity-90">{toast.description}</div>
          )}
          {severity === "error" && (
            <div className="mt-2 text-xs opacity-80">
              If this looks broken,{" "}
              <Link
                href={REPO_FORK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2 hover:opacity-100"
              >
                fork the repo
              </Link>{" "}
              and send a fix →{" "}
              <Link
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                cursor-boston
              </Link>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="-mr-1 -mt-1 px-1 text-current opacity-70 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
