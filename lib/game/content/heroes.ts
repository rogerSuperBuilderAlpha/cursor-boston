/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Hero tuning. Centralizes all the knobs for hero emergence rates,
 * stamina + conversion, and per-class effect magnitudes so combat /
 * recruitment / spell code can stay focused on their own concerns.
 *
 * Mirrors the layout of `lib/game/content/armageddon.ts` — pure
 * constants and small helpers, no Firestore, no circular imports.
 */

import type {
  Caste,
  GameHero,
  HeroClass,
  HeroSpecialty,
  LandType,
  SpellDefinition,
} from "../types";

// ── Stamina ─────────────────────────────────────────────────────────────

/** Default full-stamina value for newly-emerged heroes. */
export const STAMINA_MAX = 100;
/** Stamina regained per owner turn elapsed since last engagement. */
export const STAMINA_REGEN_PER_TURN = 20;
/** Stamina lost per engagement (attack from / attack on the hero's tile,
 *  regardless of who wins). */
export const STAMINA_DECAY_PER_ENGAGEMENT = 25;
/** Conversion is only attempted on heroes at or below this stamina. */
export const STAMINA_CONVERSION_THRESHOLD = 25;
/** Conversion success ceiling — even a fully exhausted hero (stamina 0)
 *  is only 90% likely to defect, never guaranteed. */
export const CONVERSION_SUCCESS_CEILING = 0.9;
/** Spare-withdraw stamina decrement multiplier vs. a normal engagement.
 *  Sparing requires the attacker to win but yields no territorial gain,
 *  so the wear-down is steeper than a casual engagement. */
export const SPARE_STAMINA_MULT = 2;
/** Stamina a converted hero arrives at when joining the new owner. Below
 *  full so the new owner has to invest in regen before pushing with them. */
export const POST_CONVERT_STAMINA = STAMINA_MAX / 2;

// ── Emergence rates ─────────────────────────────────────────────────────
//
// Probabilities are conservative. Real values can be tuned by playtest
// data later. Specialty multipliers (below) intentionally do NOT alter
// emergence rate — only the realized effect magnitude.

/** Chance a military hero emerges on a won battle (capture OR successful
 *  defense). Tile must not already have a hero. */
export const EMERGE_CHANCE_MILITARY = 0.04;
/** Chance a farm hero emerges on a recruitment action on a food tile. */
export const EMERGE_CHANCE_FARM = 0.025;
/** Chance a magic hero emerges on a spell cast / arm-defense from a
 *  magic tile. */
export const EMERGE_CHANCE_MAGIC = 0.035;

// ── Effect magnitudes ───────────────────────────────────────────────────

/** Military hero: base multiplicative attack bonus when attacking FROM
 *  the hero's tile. Stamina-scaled and specialty-weighted at the call site. */
export const HERO_ATTACK_BONUS = 0.2;
/** Military hero: base multiplicative defense bonus when the hero's tile
 *  is attacked. Stamina-scaled and specialty-weighted at the call site. */
export const HERO_DEFENSE_BONUS = 0.25;

/** Farm hero: contribution to the kingdom-wide recruitment % per hero
 *  (stamina-scaled). Sum across all farm heroes is clamped to FARM_HERO_GLOBAL_RECRUIT_CAP. */
export const FARM_HERO_GLOBAL_RECRUIT_BONUS = 0.1;
/** Hard cap on the summed kingdom-wide recruitment bonus from farm heroes. */
export const FARM_HERO_GLOBAL_RECRUIT_CAP = 0.5;
/** Per-recruit chance to roll a special unit on a farm-hero tile. */
export const FARM_SPECIAL_UNIT_ROLL = 0.1;

/** Magic hero: bonus "virtual magic lands" each hero contributes to the
 *  Armageddon `magicMultiplier` input. Stamina-scaled; the "armageddon"
 *  specialty doubles a hero's contribution (see specialtyArmageddonMult). */
export const MAGIC_HERO_VIRTUAL_LANDS = 1;
/** Magic hero: base multiplicative spell-magnitude bonus when a spell is
 *  cast FROM the hero's tile. Stamina-scaled and specialty-weighted. */
export const MAGIC_HERO_SPELL_BOOST = 0.15;

// ── Specialty registries ────────────────────────────────────────────────

/** Specialty draw pool per class. `maybeEmergeHero` picks uniformly from
 *  the appropriate pool. */
export const SPECIALTIES_BY_CLASS: Record<HeroClass, ReadonlyArray<HeroSpecialty>> = {
  military: ["ground", "siege", "air", "garrison", "raid", "supply"],
  farm: [
    "ground-recruit",
    "siege-recruit",
    "air-recruit",
    "summoner",
    "kingdom-buff",
  ],
  magic: [
    "spellcasting",
    "armageddon",
    "offense-spells",
    "defense-spells",
    "spying",
    "production-spells",
  ],
};

// ── LandType ↔ HeroClass adapters ───────────────────────────────────────
//
// The user-facing name "farm" doesn't match the existing LandType "food"
// (which is the building name). Keep the asymmetry in one helper instead
// of pushing it through call sites.

export function heroClassForLandType(type: LandType): HeroClass | null {
  if (type === "military") return "military";
  if (type === "food") return "farm";
  if (type === "magic") return "magic";
  return null;
}

export function landTypeForHeroClass(cls: HeroClass): LandType {
  if (cls === "military") return "military";
  if (cls === "farm") return "food";
  return "magic";
}

// ── Pure scalers ────────────────────────────────────────────────────────

/** 0..1 — fraction of max stamina the hero currently has. All hero
 *  contributions multiply by this so an exhausted hero contributes less,
 *  which couples to the wear-down/conversion mechanic. */
export function staminaScale(hero: Pick<GameHero, "stamina" | "staminaMax">): number {
  if (hero.staminaMax <= 0) return 0;
  return Math.max(0, Math.min(1, hero.stamina / hero.staminaMax));
}

/** Conversion success chance for an attacker attempting to defect a hero.
 *  Returns 0 when stamina is above STAMINA_CONVERSION_THRESHOLD (call
 *  sites should refuse to even attempt in that case). */
export function conversionSuccessChance(
  hero: Pick<GameHero, "stamina" | "staminaMax">
): number {
  if (hero.stamina > STAMINA_CONVERSION_THRESHOLD) return 0;
  const raw = 1 - staminaScale(hero);
  return Math.min(CONVERSION_SUCCESS_CEILING, raw);
}

/** Military hero: specialty-weighted attack bonus multiplier (1.0 = base).
 *  Returns 1.0 for neutral; bumps when the hero's specialty aligns with
 *  the target tile's type or the player's expected use. */
export function specialtyAttackMult(
  hero: Pick<GameHero, "class" | "specialty">,
  targetLandType: LandType | undefined
): number {
  if (hero.class !== "military") return 1;
  switch (hero.specialty) {
    case "raid":
      // Aggressive specialty — straight buff to outgoing attacks.
      return 1.25;
    case "siege":
      // Siege specialists are most useful breaking down defended ground
      // (military tiles have the standing-defense floor + tile mult).
      return targetLandType === "military" ? 1.25 : 1;
    case "air":
      // Air specialists shine attacking food/magic (lighter defenses).
      return targetLandType === "food" || targetLandType === "magic" ? 1.15 : 1;
    case "ground":
      return 1.1;
    default:
      return 1;
  }
}

/** Military hero: specialty-weighted defense bonus multiplier (1.0 = base).
 *  Accepts the attacker's source-tile land type so future specialties can
 *  vary against e.g. military sources; v1 specialties don't read it. */
export function specialtyDefenseMult(
  hero: Pick<GameHero, "class" | "specialty">,
  _sourceLandType: LandType | undefined
): number {
  if (hero.class !== "military") return 1;
  switch (hero.specialty) {
    case "garrison":
      // Pure defensive specialty.
      return 1.3;
    case "supply":
      // Defensive in depth — supply specialists punch above their weight
      // on contested ground regardless of where the attacker hails from.
      return 1.15;
    case "ground":
      return 1.1;
    default:
      return 1;
  }
}

/** Magic hero: specialty-weighted spell-magnitude bonus when casting
 *  from the hero's tile. Looks at the spell type the player is casting. */
export function specialtyCastingMult(
  hero: Pick<GameHero, "class" | "specialty">,
  spell: Pick<SpellDefinition, "type">
): number {
  if (hero.class !== "magic") return 1;
  if (hero.specialty === "spellcasting") return 1.3;
  // Match the specialty to the spell type the player is casting.
  if (hero.specialty === "offense-spells" && spell.type === "offense") return 1.5;
  if (hero.specialty === "defense-spells" && spell.type === "defense") return 1.5;
  if (hero.specialty === "spying" && spell.type === "intel") return 1.5;
  if (hero.specialty === "production-spells" && spell.type === "production") return 1.5;
  if (
    hero.specialty === "offense-spells" &&
    (spell.type === "siege" || spell.type === "attrition" || spell.type === "disarm")
  ) {
    // Other offensive cast-spells get a smaller bump.
    return 1.2;
  }
  return 1;
}

/** Magic hero: specialty-weighted Armageddon multiplier (applied to the
 *  hero's virtual-lands contribution). The "armageddon" specialty doubles
 *  it; "spellcasting" gives a small bump; others contribute 1×. */
export function specialtyArmageddonMult(
  hero: Pick<GameHero, "class" | "specialty">
): number {
  if (hero.class !== "magic") return 1;
  if (hero.specialty === "armageddon") return 2;
  if (hero.specialty === "spellcasting") return 1.25;
  return 1;
}

/** Farm hero: specialty-weighted multiplier for the per-recruit special-unit
 *  roll chance on the hero's tile. */
export function specialtyRecruitMult(
  hero: Pick<GameHero, "class" | "specialty">
): number {
  if (hero.class !== "farm") return 1;
  if (hero.specialty === "summoner") return 2;
  return 1;
}

/** Farm hero: specialty-weighted multiplier on the kingdom-wide recruit
 *  bonus contribution. Stacks before the cap. */
export function specialtyKingdomBuffMult(
  hero: Pick<GameHero, "class" | "specialty">
): number {
  if (hero.class !== "farm") return 1;
  if (hero.specialty === "kingdom-buff") return 2;
  return 1;
}

/** Farm hero: per-unit-type recruit multiplier on the hero's tile.
 *  Returns 1.0 for non-aligned specialties; 1.25 when the hero's
 *  specialty matches the unit type being recruited. */
export function specialtyTypeRecruitMult(
  hero: Pick<GameHero, "class" | "specialty">,
  unitType: "ground" | "siege" | "air"
): number {
  if (hero.class !== "farm") return 1;
  if (unitType === "ground" && hero.specialty === "ground-recruit") return 1.25;
  if (unitType === "siege" && hero.specialty === "siege-recruit") return 1.25;
  if (unitType === "air" && hero.specialty === "air-recruit") return 1.25;
  return 1;
}

// ── v2: pagination ──────────────────────────────────────────────────────

/** Page size for the per-hero events subcollection query. */
export const HERO_EVENTS_PAGE_SIZE = 50;
/** Page size for the heroes list endpoints (mine / all / fallen). */
export const HEROES_LIST_PAGE_SIZE = 30;

/** Caste-agnostic re-export so call sites that don't want to import the
 *  Caste union directly can still iterate. */
export const HERO_CLASSES: ReadonlyArray<HeroClass> = ["military", "farm", "magic"];

/** All castes, in display order. Pulled here so the name-pool registry
 *  in lib/game/content/hero-names/_index.ts can iterate without re-importing
 *  the union from types.ts (avoids a cycle). */
export const ALL_CASTES: ReadonlyArray<Caste> = [
  "black",
  "red",
  "white",
  "green",
  "blue",
];
