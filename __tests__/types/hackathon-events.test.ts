/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment node
 */

import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";
import { SPORTS_HACK_2026_EVENT_ID } from "@/lib/sports-hack-2026";
import {
  HACKATHON_EVENT_ID_LIST,
  HACKATHON_EVENT_IDS,
  type HackathonEventId,
} from "@/types/hackathon-events";

function acceptsHackathonEventId(eventId: HackathonEventId): HackathonEventId {
  return eventId;
}

describe("hackathon event ids", () => {
  it("centralizes supported hackathon event ids", () => {
    expect(HACKATHON_EVENT_IDS).toEqual({
      HACK_A_SPRINT_2026: "hack-a-sprint-2026",
      SPORTS_HACK_2026: "sports-hack-2026",
    });
    expect(HACKATHON_EVENT_ID_LIST).toEqual([
      "hack-a-sprint-2026",
      "sports-hack-2026",
    ]);
  });

  it("keeps legacy event exports sourced from the typed registry", () => {
    expect(acceptsHackathonEventId(HACK_A_SPRINT_2026_EVENT_ID)).toBe(
      HACKATHON_EVENT_IDS.HACK_A_SPRINT_2026
    );
    expect(acceptsHackathonEventId(SPORTS_HACK_2026_EVENT_ID)).toBe(
      HACKATHON_EVENT_IDS.SPORTS_HACK_2026
    );
  });
});
