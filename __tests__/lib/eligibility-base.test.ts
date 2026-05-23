/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  checkCountThreshold,
  checkEventMembership,
  checkPullRequestThreshold,
} from "@/lib/eligibility-base";

describe("eligibility-base", () => {
  describe("checkCountThreshold", () => {
    it("caps progress at the threshold and omits the reason when eligible", () => {
      expect(
        checkCountThreshold({
          current: 5,
          target: 3,
          reason: "too_low",
        }),
      ).toEqual({
        isEligible: true,
        current: 3,
        target: 3,
        reason: undefined,
      });
    });

    it("returns the failure reason when the threshold is not met", () => {
      expect(
        checkCountThreshold({
          current: 2,
          target: 3,
          reason: "too_low",
        }),
      ).toEqual({
        isEligible: false,
        current: 2,
        target: 3,
        reason: "too_low",
      });
    });
  });

  describe("checkPullRequestThreshold", () => {
    it("delegates pull request counts through the shared threshold shape", () => {
      expect(
        checkPullRequestThreshold({
          pullRequestsCount: 1,
          target: 1,
          reason: "not_submitted",
        }),
      ).toEqual({
        isEligible: true,
        current: 1,
        target: 1,
        reason: undefined,
      });
    });
  });

  describe("checkEventMembership", () => {
    it("checks signup, check-in, and confirmation gates in order", () => {
      expect(checkEventMembership({ exists: false })).toEqual({
        ok: false,
        reason: "not_signed_up",
      });
      expect(
        checkEventMembership({
          exists: true,
          confirmedAt: new Date("2026-05-01T00:00:00Z"),
          rank: 1,
        }),
      ).toEqual({ ok: false, reason: "not_checked_in" });
      expect(
        checkEventMembership({
          exists: true,
          checkedInAt: new Date("2026-05-01T00:00:00Z"),
          confirmedAt: new Date("2026-05-01T00:00:00Z"),
          rank: 7,
        }),
      ).toEqual({ ok: true, rank: 7 });
    });
  });
});
