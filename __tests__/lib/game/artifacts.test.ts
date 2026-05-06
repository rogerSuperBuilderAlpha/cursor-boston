/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  ARTIFACT_DROP_RATE,
  RARITY_WEIGHTS,
  rollArtifact,
} from "@/lib/game/artifacts";
import { makeSeededRng } from "@/lib/game/combat";
import { ALL_ARTIFACTS, ARTIFACTS_BY_ID } from "@/lib/game/content/artifacts";

describe("rollArtifact", () => {
  it("returns null when the drop check fails (below threshold)", () => {
    // RNG that always returns 0.99 — far above ARTIFACT_DROP_RATE = 0.03.
    const rng = () => 0.99;
    expect(rollArtifact(rng)).toBeNull();
  });

  it("returns an artifact when the drop check passes", () => {
    // First call is the drop gate (0.0 passes <0.03). Second is rarity, third is index.
    let callIdx = 0;
    const sequence = [0.0, 0.0, 0.0];
    const rng = () => sequence[callIdx++ % sequence.length];
    const result = rollArtifact(rng);
    expect(result).not.toBeNull();
    if (result) {
      expect(ARTIFACTS_BY_ID.has(result.id)).toBe(true);
    }
  });

  it("seeded RNG is deterministic across runs", () => {
    const a = rollArtifact(makeSeededRng("test-seed:1"));
    const b = rollArtifact(makeSeededRng("test-seed:1"));
    expect(a?.id).toEqual(b?.id);
  });

  it("drop rate over many rolls is within ±1.5% of nominal", () => {
    let drops = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) {
      const r = rollArtifact(makeSeededRng(`bench:${i}`));
      if (r) drops++;
    }
    const observed = drops / N;
    expect(Math.abs(observed - ARTIFACT_DROP_RATE)).toBeLessThan(0.015);
  });

  it("rarity distribution roughly matches RARITY_WEIGHTS over many drops", () => {
    const counts: Record<string, number> = {
      common: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
    };
    let total = 0;
    // Force successful drops by skewing the gate, but still let pickRarity vary.
    // We do this by sampling many seeds and only counting the ones that drop.
    for (let i = 0; i < 100000 && total < 5000; i++) {
      const r = rollArtifact(makeSeededRng(`rarity:${i}`));
      if (r) {
        counts[r.rarity]++;
        total++;
      }
    }
    expect(total).toBeGreaterThan(1000); // sanity check
    const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
    for (const rarity of ["common", "rare", "epic", "legendary"] as const) {
      const expected = RARITY_WEIGHTS[rarity] / totalWeight;
      const observed = counts[rarity] / total;
      // Generous tolerance for legendary at 1% — needs a wider band.
      const tolerance = rarity === "legendary" ? 0.02 : 0.05;
      expect(Math.abs(observed - expected)).toBeLessThan(tolerance);
    }
  });

  it("every registered artifact has the required fields", () => {
    for (const a of ALL_ARTIFACTS) {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.flavorOnFind).toBeTruthy();
      expect(a.baseStrength).toBeGreaterThan(0);
      expect(["common", "rare", "epic", "legendary"]).toContain(a.rarity);
      expect(["offense", "defense", "production", "utility"]).toContain(a.type);
    }
  });

  it("artifact ids are unique", () => {
    const ids = ALL_ARTIFACTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
