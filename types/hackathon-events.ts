/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export const HACKATHON_EVENT_IDS = {
  HACK_A_SPRINT_2026: "hack-a-sprint-2026",
  SPORTS_HACK_2026: "sports-hack-2026",
} as const;

export type HackathonEventId =
  (typeof HACKATHON_EVENT_IDS)[keyof typeof HACKATHON_EVENT_IDS];

export const HACKATHON_EVENT_ID_LIST = [
  HACKATHON_EVENT_IDS.HACK_A_SPRINT_2026,
  HACKATHON_EVENT_IDS.SPORTS_HACK_2026,
] as const satisfies readonly HackathonEventId[];
