/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  calculateMentorshipMatchScore,
  getTopMentorshipMatches,
} from "@/lib/mentorship/matching";
import type { MentorshipProfile } from "@/lib/mentorship/types";

function makeProfile(overrides: Partial<MentorshipProfile> = {}): MentorshipProfile {
  return {
    userId: "user-1",
    role: "mentee",
    expertise: [],
    learningGoals: [],
    preferredLanguages: [],
    timezone: "America/New_York",
    availability: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("calculateMentorshipMatchScore", () => {
  describe("goal / expertise alignment (up to 50 pts)", () => {
    it("scores higher when mentor expertise matches mentee learning goals", () => {
      const mentee = makeProfile({ role: "mentee", learningGoals: ["React", "TypeScript"] });
      const mentor = makeProfile({ userId: "mentor-1", role: "mentor", expertise: ["React", "TypeScript"] });

      const { score } = calculateMentorshipMatchScore(mentee, mentor);
      expect(score).toBeGreaterThanOrEqual(20);
    });

    it("scores 0 when there is no goal/expertise overlap", () => {
      const mentee = makeProfile({ role: "mentee", learningGoals: ["Rust"], timezone: "America/New_York" });
      const mentor = makeProfile({ userId: "mentor-1", role: "mentor", expertise: ["Python"], timezone: "Asia/Tokyo" });

      const { score } = calculateMentorshipMatchScore(mentee, mentor);
      expect(score).toBe(0);
    });

    it("gives higher score for more matching goals", () => {
      const mentee = makeProfile({ role: "mentee", learningGoals: ["React", "TypeScript", "Node.js"] });
      const mentorGood = makeProfile({ userId: "mentor-good", role: "mentor", expertise: ["React", "TypeScript", "Node.js"] });
      const mentorWeak = makeProfile({ userId: "mentor-weak", role: "mentor", expertise: ["React"] });

      const good = calculateMentorshipMatchScore(mentee, mentorGood);
      const weak = calculateMentorshipMatchScore(mentee, mentorWeak);
      expect(good.score).toBeGreaterThan(weak.score);
    });

    it("is case-insensitive when matching skills", () => {
      const mentee = makeProfile({ role: "mentee", learningGoals: ["react"] });
      const mentor = makeProfile({ userId: "mentor-1", role: "mentor", expertise: ["React"] });

      const { score } = calculateMentorshipMatchScore(mentee, mentor);
      expect(score).toBeGreaterThan(0);
    });

    it("works in reverse: mentor seeker matches against mentee candidate's goals", () => {
      const mentor = makeProfile({ role: "mentor", expertise: ["Go", "Distributed Systems"] });
      const mentee = makeProfile({ userId: "mentee-1", role: "mentee", learningGoals: ["Go"] });

      const { score, reasons } = calculateMentorshipMatchScore(mentor, mentee);
      expect(score).toBeGreaterThan(0);
      expect(reasons.some((r: string) => r.includes("Go"))).toBe(true);
    });
  });

  describe("language overlap (up to 20 pts)", () => {
    it("adds points for shared preferred languages", () => {
      const base = makeProfile({ role: "mentee", learningGoals: ["React"], preferredLanguages: ["TypeScript"] });
      const candidateWithLang = makeProfile({ userId: "c1", role: "mentor", expertise: ["React"], preferredLanguages: ["TypeScript"] });
      const candidateNoLang = makeProfile({ userId: "c2", role: "mentor", expertise: ["React"], preferredLanguages: [] });

      const withLang = calculateMentorshipMatchScore(base, candidateWithLang);
      const noLang = calculateMentorshipMatchScore(base, candidateNoLang);
      expect(withLang.score).toBeGreaterThan(noLang.score);
    });

    it("includes shared languages in reasons", () => {
      const seeker = makeProfile({ role: "mentee", learningGoals: ["React"], preferredLanguages: ["TypeScript"] });
      const candidate = makeProfile({ userId: "c1", role: "mentor", expertise: ["React"], preferredLanguages: ["TypeScript"] });

      const { reasons } = calculateMentorshipMatchScore(seeker, candidate);
      expect(reasons.some((r: string) => r.toLowerCase().includes("typescript"))).toBe(true);
    });
  });

  describe("timezone compatibility (up to 10 pts)", () => {
    it("awards bonus for identical timezones", () => {
      const base = makeProfile({ role: "mentee", learningGoals: ["React"], timezone: "America/New_York" });
      const sameZone = makeProfile({ userId: "c1", role: "mentor", expertise: ["React"], timezone: "America/New_York" });
      const diffZone = makeProfile({ userId: "c2", role: "mentor", expertise: ["React"], timezone: "Asia/Tokyo" });

      const same = calculateMentorshipMatchScore(base, sameZone);
      const diff = calculateMentorshipMatchScore(base, diffZone);
      expect(same.score).toBeGreaterThan(diff.score);
    });
  });

  describe("availability overlap (up to 15 pts)", () => {
    it("adds points when availability windows overlap", () => {
      const avail = [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }];
      const base = makeProfile({ role: "mentee", learningGoals: ["React"], availability: avail });
      const withAvail = makeProfile({ userId: "c1", role: "mentor", expertise: ["React"], availability: avail });
      const noAvail = makeProfile({ userId: "c2", role: "mentor", expertise: ["React"], availability: [] });

      const with_ = calculateMentorshipMatchScore(base, withAvail);
      const without = calculateMentorshipMatchScore(base, noAvail);
      expect(with_.score).toBeGreaterThan(without.score);
    });

    it("does not add availability points for non-overlapping windows", () => {
      const base = makeProfile({
        role: "mentee",
        learningGoals: ["React"],
        availability: [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }],
      });
      const candidate = makeProfile({
        userId: "c1",
        role: "mentor",
        expertise: ["React"],
        availability: [{ dayOfWeek: 1, startTime: "13:00", endTime: "17:00" }],
      });
      const noAvailCandidate = makeProfile({
        userId: "c2",
        role: "mentor",
        expertise: ["React"],
        availability: [],
      });

      const nonOverlap = calculateMentorshipMatchScore(base, candidate);
      const noAvail = calculateMentorshipMatchScore(base, noAvailCandidate);
      expect(nonOverlap.score).toBe(noAvail.score);
    });
  });

  describe("sparse profile penalty", () => {
    it("applies 70% penalty to profiles with zero expertise and goals", () => {
      // Same timezone gives 10 pts base → 10 * 0.3 = 3 after 70% penalty
      const seeker = makeProfile({ role: "mentee", learningGoals: ["React"], timezone: "America/New_York" });
      const emptyCandidate = makeProfile({
        userId: "c1",
        role: "mentor",
        expertise: [],
        learningGoals: [],
        timezone: "America/New_York",
      });

      const emptyResult = calculateMentorshipMatchScore(seeker, emptyCandidate);
      expect(emptyResult.score).toBeLessThanOrEqual(4);
    });

    it("scores higher for a well-filled profile than a sparse one", () => {
      const seeker = makeProfile({ role: "mentee", learningGoals: ["React", "TypeScript"] });
      const sparse = makeProfile({ userId: "sparse", role: "mentor", expertise: ["React"] });
      const full = makeProfile({ userId: "full", role: "mentor", expertise: ["React", "TypeScript", "Node.js"] });

      const sparseResult = calculateMentorshipMatchScore(seeker, sparse);
      const fullResult = calculateMentorshipMatchScore(seeker, full);
      expect(fullResult.score).toBeGreaterThan(sparseResult.score);
    });
  });

  describe("score bounds", () => {
    it("never exceeds 100", () => {
      const avail = [
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
      ];
      const seeker = makeProfile({
        role: "mentee",
        learningGoals: ["React", "TypeScript", "Node.js", "GraphQL", "AWS"],
        preferredLanguages: ["TypeScript", "JavaScript", "Python"],
        timezone: "America/New_York",
        availability: avail,
      });
      const candidate = makeProfile({
        userId: "perfect",
        role: "mentor",
        expertise: ["React", "TypeScript", "Node.js", "GraphQL", "AWS"],
        preferredLanguages: ["TypeScript", "JavaScript", "Python"],
        timezone: "America/New_York",
        availability: avail,
      });

      const { score } = calculateMentorshipMatchScore(seeker, candidate);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThan(0);
    });

    it("returns 0 for completely mismatched profiles", () => {
      const seeker = makeProfile({ role: "mentee", learningGoals: ["Rust"], timezone: "America/New_York" });
      const candidate = makeProfile({ userId: "c1", role: "mentor", expertise: ["Python"], timezone: "Asia/Tokyo" });

      const { score } = calculateMentorshipMatchScore(seeker, candidate);
      expect(score).toBe(0);
    });
  });

  describe("reasons", () => {
    it("always returns at least one reason", () => {
      const seeker = makeProfile({ role: "mentee", learningGoals: ["React"] });
      const candidate = makeProfile({ userId: "c1", role: "mentor", expertise: ["React"] });

      const { reasons } = calculateMentorshipMatchScore(seeker, candidate);
      expect(reasons.length).toBeGreaterThan(0);
    });
  });
});

describe("getTopMentorshipMatches", () => {
  it("excludes the seeker from results", () => {
    const seeker = makeProfile({ userId: "seeker", role: "mentee", learningGoals: ["React"] });
    const candidates = [
      seeker,
      makeProfile({ userId: "other", role: "mentor", expertise: ["React"] }),
    ];

    const results = getTopMentorshipMatches(seeker, candidates);
    expect(results.every((r: { userId: string }) => r.userId !== "seeker")).toBe(true);
  });

  it("excludes inactive profiles", () => {
    const seeker = makeProfile({ userId: "seeker", role: "mentee", learningGoals: ["React"] });
    const inactive = makeProfile({ userId: "inactive", role: "mentor", expertise: ["React"], isActive: false });

    const results = getTopMentorshipMatches(seeker, [seeker, inactive]);
    expect(results).toHaveLength(0);
  });

  it("returns results sorted by score descending", () => {
    const seeker = makeProfile({ userId: "seeker", role: "mentee", learningGoals: ["React", "TypeScript"] });
    const candidates = [
      makeProfile({ userId: "weak", role: "mentor", expertise: ["React"] }),
      makeProfile({ userId: "strong", role: "mentor", expertise: ["React", "TypeScript"] }),
    ];

    const results = getTopMentorshipMatches(seeker, candidates);
    expect(results[0].userId).toBe("strong");
    expect(results[0].score).toBeGreaterThanOrEqual(results[1]?.score ?? 0);
  });

  it("respects the limit parameter", () => {
    const seeker = makeProfile({ userId: "seeker", role: "mentee", learningGoals: ["React"] });
    const candidates = Array.from({ length: 15 }, (_, i) =>
      makeProfile({ userId: `mentor-${i}`, role: "mentor", expertise: ["React"] })
    );

    const results = getTopMentorshipMatches(seeker, candidates, 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("filters out zero-score matches", () => {
    const seeker = makeProfile({ userId: "seeker", role: "mentee", learningGoals: ["Rust"], timezone: "America/New_York" });
    const noMatch = makeProfile({ userId: "nomatch", role: "mentor", expertise: ["Python"], timezone: "Asia/Tokyo" });

    const results = getTopMentorshipMatches(seeker, [noMatch]);
    expect(results).toHaveLength(0);
  });
});
