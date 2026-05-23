/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import * as community from "@/lib/constants/community";
import { COMMUNITY_CONTENT_LENGTH_ERROR } from "@/lib/error-messages";

describe("community constants", () => {
  it("exports a single source of truth for community limits", () => {
    expect(Object.keys(community).length).toBeGreaterThanOrEqual(15);
    expect(community.COMMUNITY_CONTENT_MIN_LENGTH).toBe(100);
    expect(community.COMMUNITY_CONTENT_MAX_LENGTH).toBe(500);
    expect(COMMUNITY_CONTENT_LENGTH_ERROR).toBe(
      "Content must be between 100 and 500 characters"
    );
    expect(community.COMMUNITY_MY_REACTIONS_MAX_MESSAGE_IDS).toBe(60);
    expect(community.COMMUNITY_REACTIONS_QUERY_CHUNK_SIZE).toBe(10);
    expect(community.COMMUNITY_REPORT_NOTES_MAX_LENGTH).toBe(500);
  });

  it("keeps route rate-limit presets named by endpoint behavior", () => {
    expect(community.COMMUNITY_POST_RATE_LIMIT).toEqual({
      windowMs: 60_000,
      maxRequests: 10,
    });
    expect(community.COMMUNITY_REPLY_RATE_LIMIT).toEqual({
      windowMs: 60_000,
      maxRequests: 20,
    });
    expect(community.COMMUNITY_REPOST_RATE_LIMIT).toEqual({
      windowMs: 60_000,
      maxRequests: 20,
    });
    expect(community.COMMUNITY_REACTION_RATE_LIMIT).toEqual({
      windowMs: 60_000,
      maxRequests: 60,
    });
    expect(community.COMMUNITY_REPORT_RATE_LIMIT).toEqual({
      windowMs: 3_600_000,
      maxRequests: 10,
    });
    expect(community.COMMUNITY_MY_REACTIONS_RATE_LIMIT).toEqual({
      windowMs: 60_000,
      maxRequests: 120,
    });
  });
});
