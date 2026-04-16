/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { createHash, timingSafeEqual } from "crypto";

/**
 * Registry of all active treasure-hunt paths and their server-side verifiers.
 *
 * A verifier returns true iff the submitted answer is correct. Answers are
 * never rendered in HTML or shipped to the client; everything lives here.
 */

export type PathVerifier = (
  submittedAnswer: string,
  context: { uid: string; email: string }
) => boolean | Promise<boolean>;

export type TreasureHuntPath = {
  id: string;
  name: string;
  emoji: string;
  hint: string;
  verify: PathVerifier;
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function safeEqualLower(a: string, b: string): boolean {
  const an = normalize(a);
  const bn = normalize(b);
  if (an.length !== bn.length) return false;
  return timingSafeEqual(Buffer.from(an), Buffer.from(bn));
}

/**
 * Deterministic daily token for the Konami path. Rotates every UTC day.
 * Client receives the token via POST /api/hunt/oracle/konami when the user
 * types the sequence; they resubmit it to claim. Token = first 12 hex of
 * sha256(KONAMI_SALT + UTC-YYYY-MM-DD).
 */
function todayUtcDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getKonamiToken(): string {
  const salt = process.env.TREASURE_HUNT_KONAMI_SALT || "cursor-boston-konami";
  return sha256Hex(`${salt}|${todayUtcDateStr()}`).slice(0, 12);
}

/**
 * Deterministic oracle token for the API Explorer path. Rotates daily.
 */
export function getOracleAnswer(): string {
  const salt = process.env.TREASURE_HUNT_ORACLE_SALT || "cursor-boston-oracle";
  return sha256Hex(`${salt}|${todayUtcDateStr()}`);
}

export const TREASURE_HUNT_PATHS: Record<string, TreasureHuntPath> = {
  "code-reader": {
    id: "code-reader",
    name: "The Code Reader",
    emoji: "💻",
    hint:
      "The whole site is open source. One file under app/ carries a comment " +
      "hinting at the function that resolves 2026 credits. Name the function " +
      "in snake_case.",
    verify: (answer) =>
      safeEqualLower(answer, "resolve_hack_a_sprint_2026_credit_for_user"),
  },
  konami: {
    id: "konami",
    name: "The Konami Coder",
    emoji: "🎮",
    hint:
      "Old habits die hard. On the home page, the right sequence surfaces a " +
      "token. Submit the token here.",
    verify: (answer) => {
      const t = getKonamiToken();
      return safeEqualLower(answer, t);
    },
  },
  oracle: {
    id: "oracle",
    name: "The API Explorer",
    emoji: "🔌",
    hint:
      "robots.txt hides a disallowed path. Something lives under /api/hunt/oracle. " +
      "Compute the answer it describes.",
    verify: (answer) => safeEqualLower(answer, getOracleAnswer()),
  },
  librarian: {
    id: "librarian",
    name: "The Librarian",
    emoji: "📚",
    hint:
      "The welcome blog post contains zero-width whispers. Read them, visit " +
      "/hunt/{slug}, and submit the slug.",
    verify: (answer) =>
      safeEqualLower(answer, process.env.TREASURE_HUNT_LIBRARIAN_SLUG || "open-sesame"),
  },
  "badge-collector": {
    id: "badge-collector",
    name: "The Badge Collector",
    emoji: "🏅",
    hint:
      "Three badges carry hidden bits. Concatenate their slugs in the right " +
      "order to unlock the claim.",
    verify: (answer) =>
      safeEqualLower(
        answer,
        process.env.TREASURE_HUNT_BADGE_ANSWER || "firstprshowcasewinnermaintainer"
      ),
  },
  cartographer: {
    id: "cartographer",
    name: "The Cartographer",
    emoji: "🗺️",
    hint:
      "Visit five Boston neighborhoods in order. The reveal marker carries " +
      "a geohash. Submit it.",
    verify: (answer) =>
      safeEqualLower(
        answer,
        process.env.TREASURE_HUNT_CARTOGRAPHER_GEOHASH || "drt2zmw"
      ),
  },
  "cookbook-alchemist": {
    id: "cookbook-alchemist",
    name: "The Cookbook Alchemist",
    emoji: "🧪",
    hint:
      "One cookbook recipe hides a ROT13 line in its tip. Decode it and " +
      "submit the phrase.",
    verify: (answer) =>
      safeEqualLower(
        answer,
        process.env.TREASURE_HUNT_COOKBOOK_ANSWER || "promptcachinglovesyou"
      ),
  },
};

export function listPaths(): TreasureHuntPath[] {
  return Object.values(TREASURE_HUNT_PATHS);
}

export function getPath(id: string): TreasureHuntPath | null {
  return TREASURE_HUNT_PATHS[id] || null;
}
