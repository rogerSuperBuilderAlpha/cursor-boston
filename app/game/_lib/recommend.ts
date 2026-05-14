/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { GamePlayer } from "@/lib/game/types";
import { deriveShieldStatus } from "./dashboard-helpers";
import type {
  ArmyTotals,
  LandCounts,
  Recommendation,
  ThreatSummary,
} from "./dashboard-types";

/**
 * Pick the single most useful next action for the player given their
 * current state. Drives the "Recommended next" callout. Order matters:
 * earlier branches take precedence (setup steps before play steps).
 *
 * The branching logic is the dashboard's single biggest piece of UX
 * — keep this file pure and testable, and exercise it with unit tests
 * rather than touching it through the React tree.
 */
export function recommendNext(
  player: GamePlayer,
  counts: LandCounts,
  army: Pick<ArmyTotals, "total">,
  threats: ThreatSummary,
  unitCap: number
): Recommendation {
  if (player.phase === "explore") {
    return {
      title: "Reveal your starting lands",
      body:
        "Each tile you reveal costs 1 turn. The onboarding wizard walks you through it.",
      ctaLabel: "Open the wizard →",
      ctaHref: "/game",
      tone: "primary",
    };
  }
  if (counts.unassigned > 0) {
    return {
      title: `Assign your ${counts.unassigned} unassigned land${counts.unassigned === 1 ? "" : "s"}`,
      body:
        "Each tile gets a role: military builds units, food raises your unit cap, magic boosts spells. A balanced opening is roughly 10 / 10 / 5. Each assignment costs 1 turn.",
      ctaLabel: "Configure bulk distribute ↓",
      scrollTo: "bulk-distribute",
      tone: "primary",
    };
  }
  if (player.caste === null) {
    return {
      title: "Pick your caste",
      body:
        "Five factions, each with its own units, spells, and identity. Pick the one that calls to you — once you reach 1,000 tiles you can switch one time, and that second pick is permanent.",
      ctaLabel: "Pick a caste →",
      ctaHref: "/game",
      tone: "primary",
    };
  }
  if (
    army.total === 0 &&
    counts.military + counts.food + counts.magic > 0
  ) {
    const recruitable = counts.military + counts.food + counts.magic;
    const detail =
      counts.military > 0
        ? `${counts.military} military land${counts.military === 1 ? "" : "s"}`
        : `${recruitable} recruitable land${recruitable === 1 ? "" : "s"}`;
    return {
      title: "Recruit your first army",
      body: `You have ${detail} and a unit cap of ${unitCap}. A recruit batch costs 5 turns (military trains 10 units/cycle; food and magic train 5).`,
      ctaLabel: "Recruit →",
      ctaHref: "/game/recruit",
      tone: "primary",
    };
  }
  if (player.turnsRemaining < 1) {
    return {
      title: "Out of turns this week",
      body:
        "Merge a PR into cursor-boston before Sunday midnight EST and you'll get 100 turns at the next rollover.",
      ctaLabel: "How turns work",
      ctaHref: "/game/help",
      tone: "secondary",
    };
  }
  // Shielded with army → push frontier (low risk, free progress).
  const shieldStatus = deriveShieldStatus(player);
  if (shieldStatus.shielded && army.total > 0 && player.phase === "play") {
    return {
      title: "Push the frontier while you're shielded",
      body:
        "Each frontier tile costs 1 turn and has a 3% chance to surface an artifact. Use the time before your shield drops.",
      ctaLabel: "Configure frontier explore ↓",
      scrollTo: "frontier-explore",
      tone: "primary",
    };
  }
  if (!shieldStatus.shielded && threats.unshieldedNeighbors > 0) {
    const names = threats.topNeighborNames.slice(0, 2).join(", ");
    return {
      title: `${threats.unshieldedNeighbors} unshielded neighbor${threats.unshieldedNeighbors === 1 ? "" : "s"} in attack range`,
      body: names
        ? `Bordering you: ${names}. Open the world map to scout, or jump straight to the attack page.`
        : "Open the world map to scout your borders.",
      ctaLabel: "Open the map →",
      ctaHref: "/game/tiles",
      tone: "primary",
    };
  }
  if (!shieldStatus.shielded) {
    return {
      title: "No targets in range — push the frontier",
      body:
        "You aren't bordering any unshielded enemies. Explore outward to find new neighbors and pick up artifacts along the way.",
      ctaLabel: "Configure frontier explore ↓",
      scrollTo: "frontier-explore",
      tone: "primary",
    };
  }
  return {
    title: "Keep building",
    body:
      "Recruit more units, arm a defense spell on a key tile, or push the frontier for artifacts.",
    ctaLabel: "Open the map →",
    ctaHref: "/game/tiles",
    tone: "secondary",
  };
}
