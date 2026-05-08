/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { INTEL_EFFECT_DURATION_CASTER_TURNS } from "@/lib/game/intel-effects";

describe("INTEL_EFFECT_DURATION_CASTER_TURNS", () => {
  it("is 5 — the canonical lifetime for spy debuffs and Forge Sight", () => {
    // Pinned because data-server.ts and the spell descriptions reference '5
    // turns' explicitly. Changing this value requires updating the user-
    // facing copy in lib/game/content/spells/{black,green,red}/intel.ts.
    expect(INTEL_EFFECT_DURATION_CASTER_TURNS).toBe(5);
  });
});
