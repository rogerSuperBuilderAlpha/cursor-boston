/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export type AnalyticsEventName =
  | "feature_banner_view"
  | "feature_banner_cta_click"
  | "issue_claimed"
  | "sign_in_cta_click"
  | "sign_up_cta_click";

type AnalyticsPropertyValue = string | number | boolean | null | undefined;
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

const PII_KEY_PATTERN = /(email|phone|token|uid|user_?id|display_?name)/i;
const MAX_STRING_PROPERTY_LENGTH = 120;

export function sanitizeAnalyticsProperties(
  properties: AnalyticsProperties = {}
): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (PII_KEY_PATTERN.test(key) || value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string") {
      sanitized[key] = value.slice(0, MAX_STRING_PROPERTY_LENGTH);
    } else if (typeof value === "number") {
      if (Number.isFinite(value)) sanitized[key] = value;
    } else if (typeof value === "boolean") {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export async function trackEvent(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {}
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const [{ logEvent }, { analyticsReady }] = await Promise.all([
      import("firebase/analytics"),
      import("@/lib/firebase"),
    ]);
    const analytics = await analyticsReady;
    if (!analytics) return false;
    logEvent(analytics, eventName, sanitizeAnalyticsProperties(properties));
    return true;
  } catch {
    return false;
  }
}
