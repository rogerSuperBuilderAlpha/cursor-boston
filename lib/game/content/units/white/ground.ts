/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { UnitDefinition } from "../../../types";

export const WHITE_GROUND_UNIT: UnitDefinition = {
  id: "white-ground-pikeman",
  caste: "white",
  type: "ground",
  name: "Pikeman",
  attack: 9,
  defense: 14,
  hp: 11,
  description: "Disciplined infantry. Anchors a line, soaks blows.",
};
