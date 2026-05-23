/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export interface ThresholdEligibilityOptions<Reason extends string = string> {
  current: number;
  target: number;
  reason: Reason;
}

export interface ThresholdEligibilityResult<Reason extends string = string> {
  isEligible: boolean;
  current: number;
  target: number;
  reason?: Reason;
}

export function checkCountThreshold<Reason extends string = string>({
  current,
  target,
  reason,
}: ThresholdEligibilityOptions<Reason>): ThresholdEligibilityResult<Reason> {
  const isEligible = current >= target;

  return {
    isEligible,
    current: Math.min(current, target),
    target,
    reason: isEligible ? undefined : reason,
  };
}

export function checkPullRequestThreshold<Reason extends string = string>(
  options: Omit<ThresholdEligibilityOptions<Reason>, "current"> & {
    pullRequestsCount: number;
  },
): ThresholdEligibilityResult<Reason> {
  return checkCountThreshold({
    current: options.pullRequestsCount,
    target: options.target,
    reason: options.reason,
  });
}

export type EventMembershipFailureReason =
  | "not_signed_up"
  | "not_checked_in"
  | "not_confirmed";

export interface EventMembershipOptions {
  exists: boolean;
  checkedInAt?: unknown;
  checkInExempt?: boolean;
  confirmedAt?: unknown;
  rank?: unknown;
}

export type EventMembershipResult =
  | { ok: true; rank: number }
  | { ok: false; reason: EventMembershipFailureReason };

export function checkEventMembership({
  exists,
  checkedInAt,
  checkInExempt = false,
  confirmedAt,
  rank,
}: EventMembershipOptions): EventMembershipResult {
  if (!exists) {
    return { ok: false, reason: "not_signed_up" };
  }

  if (!checkedInAt && !checkInExempt) {
    return { ok: false, reason: "not_checked_in" };
  }

  if (!rank || !confirmedAt) {
    return { ok: false, reason: "not_confirmed" };
  }

  return { ok: true, rank: rank as number };
}
