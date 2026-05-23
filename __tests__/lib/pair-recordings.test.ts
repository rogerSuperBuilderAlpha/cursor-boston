/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  PAIR_SESSION_RECORDINGS,
  filterPairRecordings,
  formatPairRecordingDuration,
  getPairRecordingById,
  getPairRecordingDifficulties,
  getPairRecordingIds,
  getPairRecordingTopics,
  getPublishedPairRecordings,
} from "@/lib/pair-recordings";

describe("pair recording library", () => {
  it("keeps recording ids unique", () => {
    const ids = getPairRecordingIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only exposes recordings approved for the public library", () => {
    expect(getPublishedPairRecordings()).toHaveLength(
      PAIR_SESSION_RECORDINGS.length,
    );
    expect(
      getPublishedPairRecordings().every(
        (recording) =>
          recording.consentStatus === "approved-for-public-library",
      ),
    ).toBe(true);
  });

  it("looks up recordings by id", () => {
    expect(getPairRecordingById("react-refactor-with-cursor")?.title).toBe(
      "React Refactor With Cursor",
    );
    expect(getPairRecordingById("missing-recording")).toBeNull();
  });

  it("filters recordings by topic and difficulty", () => {
    expect(filterPairRecordings({ topic: "React refactoring" })).toHaveLength(1);
    expect(filterPairRecordings({ difficulty: "advanced" })).toHaveLength(1);
    expect(
      filterPairRecordings({
        topic: "Full-stack debugging",
        difficulty: "advanced",
      }),
    ).toHaveLength(1);
  });

  it("returns sorted topics and configured difficulties", () => {
    expect(getPairRecordingTopics()).toEqual([
      "Cursor onboarding",
      "Full-stack debugging",
      "React refactoring",
    ]);
    expect(getPairRecordingDifficulties()).toEqual([
      "beginner",
      "intermediate",
      "advanced",
    ]);
  });

  it("formats recording durations", () => {
    expect(formatPairRecordingDuration(42)).toBe("42 min");
    expect(formatPairRecordingDuration(60)).toBe("1 hr");
    expect(formatPairRecordingDuration(75)).toBe("1 hr 15 min");
  });
});
