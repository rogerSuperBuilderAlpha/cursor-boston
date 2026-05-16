/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Pure helpers for the Heroes feature. Emergence rolls, stamina
 * regen + decay, name selection. No Firestore, no transactions —
 * callers compose these into their txn flow (data-server.ts).
 *
 * The actual server-side stitching (emergence call sites, kill/spare/
 * convert flow, etc.) lives in data-server.ts. Tuning constants and
 * specialty multipliers live in lib/game/content/heroes.ts.
 */

import { randomUUID } from "node:crypto";
import {
  EMERGE_CHANCE_FARM,
  EMERGE_CHANCE_MAGIC,
  EMERGE_CHANCE_MILITARY,
  SPECIALTIES_BY_CLASS,
  STAMINA_DECAY_PER_ENGAGEMENT,
  STAMINA_MAX,
  STAMINA_REGEN_PER_TURN,
} from "./content/heroes";
import {
  FALLBACK_HERO_NAME,
  HERO_NAMES_BY_CASTE,
} from "./content/hero-names/_index";
import type {
  Caste,
  GameHero,
  GameTile,
  HeroClass,
  HeroSpecialty,
} from "./types";

/** Per-class emergence probability. */
function emergeChanceForClass(cls: HeroClass): number {
  if (cls === "military") return EMERGE_CHANCE_MILITARY;
  if (cls === "farm") return EMERGE_CHANCE_FARM;
  return EMERGE_CHANCE_MAGIC;
}

/** Deterministic name picker. Hashes `heroId` into the per-caste pool
 *  so re-renders against the same hero produce the same name. Returns
 *  FALLBACK_HERO_NAME if the pool is empty. */
export function pickHeroName(caste: Caste, heroId: string): string {
  const pool = HERO_NAMES_BY_CASTE[caste];
  if (!pool || pool.length === 0) return FALLBACK_HERO_NAME;
  let hash = 0;
  for (let i = 0; i < heroId.length; i++) {
    hash = (hash * 31 + heroId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % pool.length;
  return pool[idx];
}

/** Picks a specialty uniformly from the class's draw pool. */
function pickSpecialty(cls: HeroClass, rng: () => number): HeroSpecialty {
  const pool = SPECIALTIES_BY_CLASS[cls];
  const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[idx];
}

export interface MaybeEmergeHeroInput {
  class: HeroClass;
  tile: Pick<GameTile, "tileId" | "hero">;
  ownerId: string;
  ownerCaste: Caste;
  turnIndex: number;
  rng: () => number;
}

/** Rolls for hero emergence. Returns a freshly-constructed `GameHero` on
 *  success, `null` on miss or when the tile already has a hero. Call sites
 *  are responsible for the per-class gating (e.g. `tile.type === "food"`)
 *  and for persisting the returned hero atomically with the triggering
 *  action's write.
 *
 *  The rng is consumed twice on success — once for the emergence roll, once
 *  for the specialty draw — so seeded callers should provide a stable rng
 *  rather than re-seeding mid-flow. */
export function maybeEmergeHero(input: MaybeEmergeHeroInput): GameHero | null {
  if (input.tile.hero) return null;
  const chance = emergeChanceForClass(input.class);
  if (input.rng() >= chance) return null;
  const specialty = pickSpecialty(input.class, input.rng);
  const id = randomUUID();
  const name = pickHeroName(input.ownerCaste, id);
  return {
    id,
    ownerId: input.ownerId,
    tileId: input.tile.tileId,
    class: input.class,
    specialty,
    name,
    caste: input.ownerCaste,
    stamina: STAMINA_MAX,
    staminaMax: STAMINA_MAX,
    emergedAtTurn: input.turnIndex,
    lastEngagedAtTurn: input.turnIndex,
  };
}

/** Applies lazy stamina regen based on owner turns elapsed since
 *  `lastEngagedAtTurn`. Returns a new hero object — does not mutate.
 *  Capped at staminaMax. Use whenever a txn touches a hero before
 *  reading/writing its stamina. */
export function applyStaminaRegen(
  hero: GameHero,
  ownerTurnsSpentTotal: number
): GameHero {
  if (ownerTurnsSpentTotal <= hero.lastEngagedAtTurn) return hero;
  const elapsed = ownerTurnsSpentTotal - hero.lastEngagedAtTurn;
  const regen = elapsed * STAMINA_REGEN_PER_TURN;
  const stamina = Math.min(hero.staminaMax, hero.stamina + regen);
  if (stamina === hero.stamina) return hero;
  return {
    ...hero,
    stamina,
    lastEngagedAtTurn: ownerTurnsSpentTotal,
  };
}

/** Applies a single engagement to a hero (stamina drops by
 *  STAMINA_DECAY_PER_ENGAGEMENT × `intensity`, bumps lastEngagedAtTurn).
 *  Returns a new hero. Does not regen first — call applyStaminaRegen first
 *  if the hero may have been idle.
 *
 *  `intensity` defaults to 1; pass `SPARE_STAMINA_MULT` (2) for a spare-
 *  withdraw which wears the hero down more than a regular engagement. */
export function applyEngagement(
  hero: GameHero,
  ownerTurnsSpentTotal: number,
  intensity: number = 1
): GameHero {
  const decay = STAMINA_DECAY_PER_ENGAGEMENT * Math.max(0, intensity);
  const stamina = Math.max(0, hero.stamina - decay);
  return {
    ...hero,
    stamina,
    lastEngagedAtTurn: ownerTurnsSpentTotal,
  };
}
