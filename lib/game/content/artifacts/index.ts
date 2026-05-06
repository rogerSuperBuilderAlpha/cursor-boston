/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { ArtifactDefinition, ArtifactRarity } from "../../types";

import { COMMON_ARTIFACTS } from "./common";
import { RARE_ARTIFACTS } from "./rare";
import { EPIC_ARTIFACTS } from "./epic";
import { LEGENDARY_ARTIFACTS } from "./legendary";

export const ALL_ARTIFACTS: ArtifactDefinition[] = [
  ...COMMON_ARTIFACTS,
  ...RARE_ARTIFACTS,
  ...EPIC_ARTIFACTS,
  ...LEGENDARY_ARTIFACTS,
];

export const ARTIFACTS_BY_ID = new Map<string, ArtifactDefinition>(
  ALL_ARTIFACTS.map((a) => [a.id, a])
);

export const ARTIFACTS_BY_RARITY: Record<ArtifactRarity, ArtifactDefinition[]> = {
  common: COMMON_ARTIFACTS,
  rare: RARE_ARTIFACTS,
  epic: EPIC_ARTIFACTS,
  legendary: LEGENDARY_ARTIFACTS,
};
