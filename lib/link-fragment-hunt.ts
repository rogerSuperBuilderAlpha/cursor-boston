/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Six-puzzle scavenger hunt: each solved puzzle reveals a 2-character slice of
 * a Cursor referral code. Fragments are returned only from the verify API with
 * an HMAC token; the full code never ships in client bundles.
 */

export const LINK_FRAGMENT_COUNT = 6;
export const LINK_FRAGMENT_REFERRAL_BASE = "https://cursor.com/referral?code=";

export type LinkFragmentPuzzleId =
  | "home-pulse"
  | "about-beantown"
  | "events-perks"
  | "cohort-campus"
  | "hult-guest"
  | "opensource-reader";

export type LinkFragmentPuzzle = {
  id: LinkFragmentPuzzleId;
  /** Pathname where the clue lives (exact or prefix). */
  page: string;
  emoji: string;
  title: string;
  hint: string;
  verify: (answer: string) => boolean;
  index: number;
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

function safeEqualLower(a: string, b: string): boolean {
  const an = normalize(a);
  const bn = normalize(b);
  if (an.length !== bn.length) return false;
  return timingSafeEqual(Buffer.from(an), Buffer.from(bn));
}

function huntSecret(): string {
  return (
    process.env.LINK_FRAGMENT_HUNT_SECRET?.trim() ||
    process.env.UNSUBSCRIBE_SECRET?.trim() ||
    "link-fragment-hunt-dev-secret-32b"
  );
}

/** 12-character referral code, split into six 2-char fragments. */
export function getLinkFragmentReferralCode(): string {
  const code = (process.env.LINK_FRAGMENT_HUNT_CODE || "HULTSUMMER26").trim();
  if (!/^[A-Za-z0-9]{12}$/.test(code)) {
    throw new Error(
      "LINK_FRAGMENT_HUNT_CODE must be exactly 12 alphanumeric characters."
    );
  }
  return code.toUpperCase();
}

export function getLinkFragmentSlices(): string[] {
  const code = getLinkFragmentReferralCode();
  return Array.from({ length: LINK_FRAGMENT_COUNT }, (_, i) =>
    code.slice(i * 2, i * 2 + 2)
  );
}

export function signLinkFragmentToken(
  puzzleId: LinkFragmentPuzzleId,
  fragment: string
): string {
  return createHmac("sha256", huntSecret())
    .update(`link-frag|${puzzleId}|${fragment}`)
    .digest("base64url");
}

export function verifyLinkFragmentToken(
  puzzleId: LinkFragmentPuzzleId,
  fragment: string,
  token: string
): boolean {
  const expected = signLinkFragmentToken(puzzleId, fragment);
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function assembleReferralUrl(
  tokens: Partial<Record<LinkFragmentPuzzleId, string>>
): { ok: true; url: string } | { ok: false; reason: string } {
  const puzzles = listLinkFragmentPuzzles();
  const slices = getLinkFragmentSlices();
  let code = "";

  for (const puzzle of puzzles) {
    const token = tokens[puzzle.id];
    if (!token) {
      return { ok: false, reason: "missing_fragment" };
    }
    const fragment = slices[puzzle.index];
    if (!fragment || !verifyLinkFragmentToken(puzzle.id, fragment, token)) {
      return { ok: false, reason: "invalid_token" };
    }
    code += fragment;
  }

  return { ok: true, url: `${LINK_FRAGMENT_REFERRAL_BASE}${code}` };
}

export const LINK_FRAGMENT_PUZZLES: Record<
  LinkFragmentPuzzleId,
  LinkFragmentPuzzle
> = {
  "home-pulse": {
    id: "home-pulse",
    page: "/",
    emoji: "💓",
    title: "The Seven Beats",
    hint:
      "On the home page, the logo remembers old arcade rhythms. Seven quick taps " +
      "within a few seconds unlock the first pair of characters.",
    verify: (answer) => safeEqualLower(answer, "seven-beats"),
    index: 0,
  },
  "about-beantown": {
    id: "about-beantown",
    page: "/about",
    emoji: "🫘",
    title: "Beantown Roots",
    hint:
      "View source on the About page. A comment whispers the city's nickname — " +
      "submit it here.",
    verify: (answer) => safeEqualLower(answer, "beantown"),
    index: 1,
  },
  "events-perks": {
    id: "events-perks",
    page: "/events",
    emoji: "🍕",
    title: "Perk Counter",
    hint:
      "The Hult Summer Hackathon lists its perks on the Events page. How many? " +
      "Digits only.",
    verify: (answer) => safeEqualLower(answer, "4"),
    index: 2,
  },
  "cohort-campus": {
    id: "cohort-campus",
    page: "/summer-cohort",
    emoji: "🎓",
    title: "Campus on Education St",
    hint:
      "Summer cohort copy points at a Cambridge business school. Submit the " +
      "school's short name (one word).",
    verify: (answer) => safeEqualLower(answer, "hult"),
    index: 3,
  },
  "hult-guest": {
    id: "hult-guest",
    page: "/events/cursor-boston-hult-summer-hackathon-2026",
    emoji: "✨",
    title: "The 2:30 Guest",
    hint:
      "On the Hult hackathon event page, find who joins at 2:30 PM from Cursor. " +
      "Submit their first and last name.",
    verify: (answer) => safeEqualLower(answer, "shivjethi"),
    index: 4,
  },
  "opensource-reader": {
    id: "opensource-reader",
    page: "/open-source",
    emoji: "💻",
    title: "The Code Reader",
    hint:
      "Open Source page source names a snake_case function that resolves 2026 " +
      "credits. Submit that function name.",
    verify: (answer) =>
      safeEqualLower(answer, "resolve_hack_a_sprint_2026_credit_for_user"),
    index: 5,
  },
};

export function listLinkFragmentPuzzles(): LinkFragmentPuzzle[] {
  return Object.values(LINK_FRAGMENT_PUZZLES).sort((a, b) => a.index - b.index);
}

export function getLinkFragmentPuzzle(
  id: string
): LinkFragmentPuzzle | null {
  return LINK_FRAGMENT_PUZZLES[id as LinkFragmentPuzzleId] ?? null;
}

export function linkFragmentHuntEnabled(): boolean {
  return process.env.LINK_FRAGMENT_HUNT_ENABLED !== "false";
}
