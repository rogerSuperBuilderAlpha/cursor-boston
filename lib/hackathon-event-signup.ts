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

/**
 * Sort key for the combined website + Luma leaderboard (and freeze top-N).
 * PR count desc → website signup before Luma-only → earlier registration first.
 */
export type UnifiedHackathonRankSortFields = {
  mergedPrCount: number;
  source: "website" | "luma_only";
  signedUpAtMs: number;
};

export function compareUnifiedHackathonRanking(
  a: UnifiedHackathonRankSortFields,
  b: UnifiedHackathonRankSortFields
): number {
  if (b.mergedPrCount !== a.mergedPrCount) {
    return b.mergedPrCount - a.mergedPrCount;
  }
  const aWeb = a.source === "website" ? 1 : 0;
  const bWeb = b.source === "website" ? 1 : 0;
  if (bWeb !== aWeb) return bWeb - aWeb;
  return a.signedUpAtMs - b.signedUpAtMs;
}

/** Judges / organizers — excluded from the participant list so they don't take a spot. */
export const JUDGE_EMAILS = new Set([
  "regorhunt02052@gmail.com",
  "rayruizhiliao@gmail.com",
  "ray@vectorly.app",
  "ashbhatia@gmail.com",
  "mikeboensel@gmail.com",
]);

/**
 * Judges may not appear on the door check-in tablet; treat matching profiles as checked in
 * for Hack-a-Sprint2026 app gates (peer list, /me, credit check-in step).
 */
export function profileMatchesHackathonJudgeCheckinException(
  tokenEmail: string | null | undefined,
  profile: Record<string, unknown> | undefined
): boolean {
  if (typeof tokenEmail === "string" && JUDGE_EMAILS.has(tokenEmail.trim().toLowerCase())) {
    return true;
  }
  if (!profile) return false;
  if (typeof profile.email === "string" && JUDGE_EMAILS.has(profile.email.trim().toLowerCase())) {
    return true;
  }
  for (const entry of (profile.additionalEmails as
    | Array<{ verified?: boolean; email?: string }>
    | undefined) ?? []) {
    if (
      entry?.verified &&
      typeof entry?.email === "string" &&
      JUDGE_EMAILS.has(entry.email.trim().toLowerCase())
    ) {
      return true;
    }
  }
  return false;
}

/** Luma registrants who declined — excluded from the participant list. */
export const DECLINED_EMAILS = new Set([
  "nasit.v@northeastern.edu",
  "renganathan.b@northeastern.edu",
  "revoftc@gmail.com",
  "sakhare.c@northeastern.edu",
  "lnu.ava@northeastern.edu",
  "harrychow8888@gmail.com",
  "brucejia@bu.edu",
  "gehlotvansh111@gmail.com",
  "torresr14@gmail.com",
  "salve.a@northeastern.edu",
  "aarjav02@gmail.com",
  "kompella.sa@northeastern.edu",
  "oalshayeb1@babson.edu",
  "mouhssine.rifaki@nyu.edu",
  "jack@stepwise.ai",
  "patil.jaye@northeastern.edu",
  "sahana359@gmail.com",
  "grosz.justin@bcg.com",
  "chun.yimin@gmail.com",
  "ananya@aicollective.com",
]);
