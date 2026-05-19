/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { UnitDefinition } from "../../../types";

export const WHITE_SIEGE_UNIT: UnitDefinition = {
  id: "white-siege-bombardier",
  caste: "white",
  type: "siege",
  name: "Bombardier",
  attack: 16,
  defense: 7,
  hp: 9,
  description: "Cannoneer of the white order. Reliable, never reckless.",
};
