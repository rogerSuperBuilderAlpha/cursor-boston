/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import { githubUserHasRecentlyMergedPr } from "@/lib/hackathon-showcase";

export const TREASURE_HUNT_PR_WINDOW_HOURS = 24;

export type TreasureHuntReason =
  | "not_signed_in"
  | "no_github"
  | "no_discord"
  | "no_recent_pr"
  | "already_won"
  | "feature_disabled";

export type TreasureHuntEligibility =
  | { ok: true; githubLogin: string; discordUsername: string }
  | { ok: false; reason: TreasureHuntReason };

export function treasureHuntEnabled(): boolean {
  return process.env.TREASURE_HUNT_ENABLED !== "false";
}

/**
 * Full eligibility check: auth + GitHub linked + Discord linked + 24h merged PR +
 * has not already won. Designed to mirror the shape of
 * resolveHackASprint2026CreditForUser.
 */
export async function checkTreasureHuntEligibility(
  db: Firestore,
  uid: string
): Promise<TreasureHuntEligibility> {
  if (!treasureHuntEnabled()) return { ok: false, reason: "feature_disabled" };
  if (!uid) return { ok: false, reason: "not_signed_in" };

  const userSnap = await db.collection("users").doc(uid).get();
  const ud = userSnap.data() || {};

  const githubLogin =
    ud.github && typeof ud.github === "object"
      ? ((ud.github as { login?: string }).login || "").trim()
      : "";
  if (!githubLogin) return { ok: false, reason: "no_github" };

  const discordUsername =
    ud.discord && typeof ud.discord === "object"
      ? ((ud.discord as { username?: string }).username || "").trim()
      : "";
  if (!discordUsername) return { ok: false, reason: "no_discord" };

  const progressSnap = await db.collection("treasureHuntProgress").doc(uid).get();
  const progress = progressSnap.data();
  if (progress?.prizeCodeId) return { ok: false, reason: "already_won" };

  const hasRecentPr = await githubUserHasRecentlyMergedPr(
    githubLogin,
    TREASURE_HUNT_PR_WINDOW_HOURS
  );
  if (!hasRecentPr) return { ok: false, reason: "no_recent_pr" };

  return { ok: true, githubLogin, discordUsername };
}

/**
 * Checks whether a given verified email has already won — used to block
 * alt-account farming where a user links different uids to the same email.
 */
export async function emailAlreadyWon(
  db: Firestore,
  email: string
): Promise<boolean> {
  const lower = email.trim().toLowerCase();
  if (!lower) return false;
  const snap = await db
    .collection("treasureHuntProgress")
    .where("winnerEmailLower", "==", lower)
    .limit(1)
    .get();
  return !snap.empty;
}
