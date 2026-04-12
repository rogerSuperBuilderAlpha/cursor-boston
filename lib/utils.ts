/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Timestamp } from "firebase/firestore";

/**
 * Merge class names, filtering out falsy values.
 *
 * @param classes - Any mix of strings and falsy placeholders.
 * @returns Space-joined class string.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Derive one- or two-letter initials from a display name.
 *
 * @param name - Full name or empty.
 * @returns Uppercase initials, or `"?"` when missing.
 */
export function getInitials(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed[0].toUpperCase();
}

/**
 * Stable display name: trimmed `name`, else email local-part, else `"Anonymous"`.
 *
 * @param user - Object with optional `name` and `email`.
 * @returns Non-empty display string.
 */
export function getDisplayName(user: {
  name?: string | null;
  email?: string | null;
}): string {
  const trimmedName = user.name?.trim();
  if (trimmedName) return trimmedName;

  const trimmedEmail = user.email?.trim();
  if (!trimmedEmail) return "Anonymous";

  const atIndex = trimmedEmail.indexOf("@");
  if (atIndex > 0) {
    return trimmedEmail.slice(0, atIndex);
  }

  return "Anonymous";
}

/**
 * Format a Firestore timestamp as a relative string.
 *
 * @param timestamp - Firestore timestamp instance.
 * @returns Strings like `"just now"`, `"5m ago"`, or `"Mar 5"`; empty string if invalid.
 */
export function formatRelativeDate(timestamp: Timestamp): string {
  if (!timestamp?.toDate) return "";
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
