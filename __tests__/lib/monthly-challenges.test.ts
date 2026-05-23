/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  MONTHLY_CHALLENGES,
  getChallengeById,
  getChallengeIds,
  getChallengeRubricTotal,
  getCurrentChallenge,
} from "@/lib/monthly-challenges";

describe("monthly challenge data", () => {
  it("keeps challenge ids unique", () => {
    const ids = getChallengeIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns the configured current challenge", () => {
    const current = getCurrentChallenge();
    expect(current.status).toBe("current");
    expect(current.id).toBe("2026-06-agentic-debugging");
  });

  it("looks up challenges by id", () => {
    expect(getChallengeById("2026-05-refactor-safety-net")?.title).toBe(
      "Refactor Safety Net",
    );
    expect(getChallengeById("missing-challenge")).toBeNull();
  });

  it("calculates rubric totals", () => {
    for (const challenge of MONTHLY_CHALLENGES) {
      expect(getChallengeRubricTotal(challenge)).toBe(100);
    }
  });

  it("keeps ids in the same order as the challenge archive", () => {
    expect(getChallengeIds()).toEqual(
      MONTHLY_CHALLENGES.map((challenge) => challenge.id),
    );
  });
});
