/**
 * @jest-environment node
 *
 * Coverage push #69 — lib/game/content/heroes.ts (pure helpers).
 * Drives the specialty-multiplier branches that aren't currently
 * exercised by the integration coverage (74% file). All pure.
 */
import {
  conversionSuccessChance,
  heroClassForLandType,
  landTypeForHeroClass,
  specialtyArmageddonMult,
  specialtyAttackMult,
  specialtyCastingMult,
  specialtyDefenseMult,
  specialtyKingdomBuffMult,
  specialtyRecruitMult,
  specialtyTypeRecruitMult,
  staminaScale,
} from "@/lib/game/content/heroes";

type HeroLike = { class: string; specialty: string };

describe("heroClassForLandType + landTypeForHeroClass", () => {
  it("heroClassForLandType maps land types correctly", () => {
    expect(heroClassForLandType("military")).toBe("military");
    expect(heroClassForLandType("food")).toBe("farm");
    expect(heroClassForLandType("magic")).toBe("magic");
    expect(heroClassForLandType("unrevealed" as never)).toBeNull();
    expect(heroClassForLandType("unassigned" as never)).toBeNull();
  });

  it("landTypeForHeroClass maps hero classes correctly", () => {
    expect(landTypeForHeroClass("military")).toBe("military");
    expect(landTypeForHeroClass("farm")).toBe("food");
    expect(landTypeForHeroClass("magic")).toBe("magic");
  });
});

describe("staminaScale + conversionSuccessChance", () => {
  it("staminaScale returns 0 for zero max", () => {
    expect(staminaScale({ stamina: 10, staminaMax: 0 } as never)).toBe(0);
  });

  it("staminaScale clamps to [0,1]", () => {
    expect(staminaScale({ stamina: 5, staminaMax: 10 } as never)).toBe(0.5);
    expect(staminaScale({ stamina: 20, staminaMax: 10 } as never)).toBe(1);
    expect(staminaScale({ stamina: -5, staminaMax: 10 } as never)).toBe(0);
  });

  it("conversionSuccessChance is 0 when stamina is above the threshold", () => {
    // STAMINA_CONVERSION_THRESHOLD is some positive integer; a very-high
    // stamina value safely exceeds it.
    expect(conversionSuccessChance({ stamina: 99999, staminaMax: 100000 } as never)).toBe(0);
  });

  it("conversionSuccessChance returns a positive chance for low-stamina heroes", () => {
    const c = conversionSuccessChance({ stamina: 1, staminaMax: 100 } as never);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThanOrEqual(1);
  });
});

describe("specialtyAttackMult", () => {
  it("returns 1.0 for non-military heroes", () => {
    expect(specialtyAttackMult({ class: "magic", specialty: "x" } as never, "military")).toBe(1);
  });

  it("raid specialty boosts all attacks", () => {
    expect(specialtyAttackMult({ class: "military", specialty: "raid" } as never, "military")).toBe(1.25);
    expect(specialtyAttackMult({ class: "military", specialty: "raid" } as never, "food")).toBe(1.25);
  });

  it("siege specialty boosts attacks on military tiles only", () => {
    expect(specialtyAttackMult({ class: "military", specialty: "siege" } as never, "military")).toBe(1.25);
    expect(specialtyAttackMult({ class: "military", specialty: "siege" } as never, "food")).toBe(1);
  });

  it("air specialty boosts attacks on food + magic tiles", () => {
    expect(specialtyAttackMult({ class: "military", specialty: "air" } as never, "food")).toBe(1.15);
    expect(specialtyAttackMult({ class: "military", specialty: "air" } as never, "magic")).toBe(1.15);
    expect(specialtyAttackMult({ class: "military", specialty: "air" } as never, "military")).toBe(1);
  });

  it("ground specialty gives a small boost everywhere", () => {
    expect(specialtyAttackMult({ class: "military", specialty: "ground" } as never, "military")).toBe(1.1);
  });

  it("unknown specialty falls through to 1.0", () => {
    expect(specialtyAttackMult({ class: "military", specialty: "weird" } as never, "food")).toBe(1);
  });
});

describe("specialtyDefenseMult", () => {
  it("returns 1.0 for non-military", () => {
    expect(specialtyDefenseMult({ class: "magic", specialty: "x" } as HeroLike, undefined)).toBe(1);
  });

  it("garrison gives the strongest defense boost", () => {
    expect(specialtyDefenseMult({ class: "military", specialty: "garrison" } as HeroLike, undefined)).toBe(1.3);
  });

  it("supply gives a moderate defense boost", () => {
    expect(specialtyDefenseMult({ class: "military", specialty: "supply" } as HeroLike, undefined)).toBe(1.15);
  });

  it("ground gives a small defense boost", () => {
    expect(specialtyDefenseMult({ class: "military", specialty: "ground" } as HeroLike, undefined)).toBe(1.1);
  });

  it("unknown specialty defaults to 1.0", () => {
    expect(specialtyDefenseMult({ class: "military", specialty: "weird" } as HeroLike, undefined)).toBe(1);
  });
});

describe("specialtyCastingMult", () => {
  it("returns 1.0 for non-magic", () => {
    expect(specialtyCastingMult({ class: "military", specialty: "x" } as HeroLike, { type: "offense" } as never)).toBe(1);
  });

  it("spellcasting boosts everything", () => {
    expect(specialtyCastingMult({ class: "magic", specialty: "spellcasting" } as HeroLike, { type: "intel" } as never)).toBe(1.3);
  });

  it("offense-spells boosts offense spells", () => {
    expect(specialtyCastingMult({ class: "magic", specialty: "offense-spells" } as HeroLike, { type: "offense" } as never)).toBe(1.5);
  });

  it("defense-spells boosts defense spells", () => {
    expect(specialtyCastingMult({ class: "magic", specialty: "defense-spells" } as HeroLike, { type: "defense" } as never)).toBe(1.5);
  });

  it("spying boosts intel spells", () => {
    expect(specialtyCastingMult({ class: "magic", specialty: "spying" } as HeroLike, { type: "intel" } as never)).toBe(1.5);
  });

  it("production-spells boosts production spells", () => {
    expect(specialtyCastingMult({ class: "magic", specialty: "production-spells" } as HeroLike, { type: "production" } as never)).toBe(1.5);
  });

  it("offense-spells gives a partial boost to siege/attrition/disarm spells", () => {
    expect(specialtyCastingMult({ class: "magic", specialty: "offense-spells" } as HeroLike, { type: "siege" } as never)).toBe(1.2);
    expect(specialtyCastingMult({ class: "magic", specialty: "offense-spells" } as HeroLike, { type: "attrition" } as never)).toBe(1.2);
    expect(specialtyCastingMult({ class: "magic", specialty: "offense-spells" } as HeroLike, { type: "disarm" } as never)).toBe(1.2);
  });

  it("unrelated combinations fall through to 1.0", () => {
    expect(specialtyCastingMult({ class: "magic", specialty: "defense-spells" } as HeroLike, { type: "offense" } as never)).toBe(1);
  });
});

describe("specialtyArmageddonMult", () => {
  it("non-magic → 1.0", () => {
    expect(specialtyArmageddonMult({ class: "military", specialty: "armageddon" } as HeroLike)).toBe(1);
  });

  it("armageddon specialty doubles", () => {
    expect(specialtyArmageddonMult({ class: "magic", specialty: "armageddon" } as HeroLike)).toBe(2);
  });

  it("spellcasting specialty gives a small bump", () => {
    expect(specialtyArmageddonMult({ class: "magic", specialty: "spellcasting" } as HeroLike)).toBe(1.25);
  });

  it("other magic specialties → 1.0", () => {
    expect(specialtyArmageddonMult({ class: "magic", specialty: "intel" } as HeroLike)).toBe(1);
  });
});

describe("specialtyRecruitMult", () => {
  it("non-farm → 1.0", () => {
    expect(specialtyRecruitMult({ class: "military", specialty: "summoner" } as HeroLike)).toBe(1);
  });

  it("summoner specialty doubles", () => {
    expect(specialtyRecruitMult({ class: "farm", specialty: "summoner" } as HeroLike)).toBe(2);
  });

  it("non-summoner farm specialty → 1.0", () => {
    expect(specialtyRecruitMult({ class: "farm", specialty: "kingdom-buff" } as HeroLike)).toBe(1);
  });
});

describe("specialtyKingdomBuffMult", () => {
  it("non-farm → 1.0", () => {
    expect(specialtyKingdomBuffMult({ class: "magic", specialty: "kingdom-buff" } as HeroLike)).toBe(1);
  });

  it("kingdom-buff farm specialty doubles", () => {
    expect(specialtyKingdomBuffMult({ class: "farm", specialty: "kingdom-buff" } as HeroLike)).toBe(2);
  });

  it("other farm specialty → 1.0", () => {
    expect(specialtyKingdomBuffMult({ class: "farm", specialty: "summoner" } as HeroLike)).toBe(1);
  });
});

describe("specialtyTypeRecruitMult", () => {
  it("non-farm → 1.0", () => {
    expect(specialtyTypeRecruitMult({ class: "military", specialty: "ground" } as HeroLike, "ground")).toBe(1);
  });

  it("matched specialty → 1.25", () => {
    expect(specialtyTypeRecruitMult({ class: "farm", specialty: "ground-recruit" } as HeroLike, "ground")).toBe(1.25);
    expect(specialtyTypeRecruitMult({ class: "farm", specialty: "siege-recruit" } as HeroLike, "siege")).toBe(1.25);
    expect(specialtyTypeRecruitMult({ class: "farm", specialty: "air-recruit" } as HeroLike, "air")).toBe(1.25);
  });

  it("mismatched specialty → 1.0", () => {
    expect(specialtyTypeRecruitMult({ class: "farm", specialty: "ground-recruit" } as HeroLike, "air")).toBe(1);
  });

  it("non-aligned farm specialty → 1.0", () => {
    expect(specialtyTypeRecruitMult({ class: "farm", specialty: "summoner" } as HeroLike, "ground")).toBe(1);
  });
});
