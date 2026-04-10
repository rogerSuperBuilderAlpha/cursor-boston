/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";

/** In-person / special events with website signup (separate from Luma). */
export const HACKATHON_EVENT_SIGNUP_IDS = [HACK_A_SPRINT_2026_EVENT_ID] as const;

export type HackathonEventSignupId = (typeof HACKATHON_EVENT_SIGNUP_IDS)[number];

export function isHackathonEventSignupId(
  eventId: string
): eventId is HackathonEventSignupId {
  return (HACKATHON_EVENT_SIGNUP_IDS as readonly string[]).includes(eventId);
}

export function hackathonEventSignupDocId(
  eventId: string,
  userId: string
): string {
  return `${eventId}__${userId}`;
}

/**
 * Same bar as virtual hackathon pool (public profile, GitHub, visible Discord),
 * but no monthly left-team lockout — this is for a specific in-person event.
 */
export function getHackathonEventSignupBlockReason(
  profile: Record<string, unknown> | undefined
): string | null {
  if (!profile) {
    return "Profile not found.";
  }
  const visibility = (profile.visibility as Record<string, unknown> | undefined) ?? {};
  if (visibility.isPublic !== true) {
    return "Make your profile public in Settings to sign up.";
  }
  if (!profile.github) {
    return "Connect GitHub in your profile to sign up.";
  }
  if (!profile.discord) {
    return "Connect Discord in your profile to sign up.";
  }
  if (visibility.showDiscord !== true) {
    return "Turn on “Show Discord” in your public profile to sign up.";
  }
  return null;
}

export const CURSOR_CREDIT_TOP_N = 50;

/** Judges / organizers — excluded from the participant list so they don't take a spot. */
export const JUDGE_EMAILS = new Set([
  "regorhunt02052@gmail.com",
  "rayruizhiliao@gmail.com",
]);
