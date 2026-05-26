/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((el) => el.getAttribute("aria-hidden") !== "true");
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Width of the centered panel. Default "md". */
  size?: ModalSize;
  /**
   * id of the heading element rendered inside the modal. When set, the modal
   * receives `aria-labelledby={titleId}`. Provide either this or `ariaLabel`.
   */
  titleId?: string;
  /**
   * Accessible label for the dialog itself. Use when no visible heading is
   * available (rare — prefer `titleId` so screen readers announce the
   * actual modal heading).
   */
  ariaLabel?: string;
  /** Extra classes appended to the panel. */
  className?: string;
  /**
   * Backdrop classes. When omitted, defaults to a semi-opaque blurred backdrop
   * (`bg-black/80 backdrop-blur-sm`). When provided, REPLACES the defaults
   * — pass the full background/blur treatment you want.
   */
  backdropClassName?: string;
  /** Default true. Pass false for callers that own their own padding/layout. */
  padded?: boolean;
  /** Default true. Pass false for callers that own panel rounding/shadow. */
  defaultPanelChrome?: boolean;
  /**
   * Default true. When true the panel scrolls internally up to ~90vh so tall
   * content stays reachable on small viewports. Pass false when the caller
   * manages its own scroll region (e.g. an internal scroll container).
   */
  panelScroll?: boolean;
  /** Show the corner close-X button. Default true. */
  showCloseButton?: boolean;
  /** Accessible label for the corner close-X. Default "Close". */
  closeButtonLabel?: string;
  /** Dismiss when the backdrop is clicked. Default true. */
  closeOnBackdropClick?: boolean;
  /** Dismiss on Escape key. Default true. */
  closeOnEsc?: boolean;
  /** Lock body scroll while the modal is open. Default true. */
  lockBodyScroll?: boolean;
  children: ReactNode;
}

function handleTabTrap(e: KeyboardEvent, panel: HTMLElement) {
  if (e.key !== "Tab") return;
  const focusable = getFocusable(panel);
  if (focusable.length === 0) {
    e.preventDefault();
    panel.focus({ preventScroll: true });
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  if (!active || !panel.contains(active)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus({ preventScroll: true });
    return;
  }
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus({ preventScroll: true });
  }
}

/**
 * Shared modal shell. Owns the backdrop, focus management, ESC/click dismissal,
 * body scroll-lock, and the corner close-X. Renders nothing when closed.
 *
 * The caller renders the dialog content — header, body, footer — as children.
 * The shell intentionally does not impose a header/footer structure because
 * existing modals diverge on layout; `padded={false}` opts out of the default
 * panel padding so callers can section the panel themselves.
 *
 * Keyboard behavior:
 *   - Escape: handled via a document-level listener so it dismisses even
 *     when focus has drifted outside the dialog subtree.
 *   - Tab / Shift+Tab: trapped within the panel via a native keydown
 *     listener on the outer dialog — wraps focus at the boundary.
 *
 * On open, focus moves into the panel (first focusable, falling back to the
 * panel itself). On close/unmount the previously-focused element is restored.
 */
export function Modal({
  isOpen,
  onClose,
  size = "md",
  titleId,
  ariaLabel,
  className,
  backdropClassName,
  padded = true,
  defaultPanelChrome = true,
  panelScroll = true,
  showCloseButton = true,
  closeButtonLabel = "Close",
  closeOnBackdropClick = true,
  closeOnEsc = true,
  lockBodyScroll = true,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const panel = panelRef.current;
    if (panel) {
      const [first] = getFocusable(panel);
      (first ?? panel).focus({ preventScroll: true });
    }
    return () => {
      previouslyFocusedRef.current?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !lockBodyScroll) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen, lockBodyScroll]);

  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, closeOnEsc, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    if (!dialog || !panel) return;
    const handler = (e: KeyboardEvent) => handleTabTrap(e, panel);
    dialog.addEventListener("keydown", handler);
    return () => dialog.removeEventListener("keydown", handler);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-label={titleId ? undefined : ariaLabel}
    >
      <div
        className={cn(
          "absolute inset-0",
          backdropClassName ?? "bg-black/80 backdrop-blur-sm",
        )}
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        data-modal-content
        tabIndex={-1}
        className={cn(
          "relative w-full",
          SIZE_CLASS[size],
          defaultPanelChrome &&
            "rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl",
          padded && "p-6 md:p-8",
          panelScroll && "max-h-[90vh] overflow-y-auto",
          className,
        )}
      >
        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeButtonLabel}
            className="absolute right-4 top-4 rounded-lg p-1 text-neutral-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <CloseIcon size={20} />
          </button>
        ) : null}

        {children}
      </div>
    </div>
  );
}
