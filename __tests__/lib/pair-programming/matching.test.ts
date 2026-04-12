/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { calculateMatchScore, getTopMatches } from "@/lib/pair-programming/matching";
import type { PairProfile } from "@/lib/pair-programming/types";

function makeProfile(overrides: Partial<PairProfile> = {}): PairProfile {
  return {
    userId: "user-1",
    skillsCanTeach: [],
    skillsWantToLearn: [],
    preferredLanguages: [],
    preferredFrameworks: [],
    timezone: "America/New_York",
    availability: [],
    sessionTypes: [],
    bio: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    ...overrides,
  };
}

describe("calculateMatchScore", () => {
  it("returns low score for two empty profiles (only timezone bonus)", () => {
    const p1 = makeProfile();
    const p2 = makeProfile({ userId: "user-2" });
    const result = calculateMatchScore(p1, p2);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.userId).toBe("user-2");
  });

  it("scores skill complementarity (teach/learn match)", () => {
    const p1 = makeProfile({
      skillsCanTeach: ["React"],
      skillsWantToLearn: ["Python"],
    });
    const p2 = makeProfile({
      userId: "user-2",
      skillsCanTeach: ["Python"],
      skillsWantToLearn: ["React"],
    });
    const result = calculateMatchScore(p1, p2);
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons.some((r) => r.includes("React"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("Python"))).toBe(true);
  });

  it("skill matching is case-insensitive", () => {
    const p1 = makeProfile({ skillsCanTeach: ["react"] });
    const p2 = makeProfile({
      userId: "user-2",
      skillsWantToLearn: ["React"],
    });
    const result = calculateMatchScore(p1, p2);
    expect(result.score).toBeGreaterThan(0);
  });

  it("scores language/framework overlap", () => {
    const p1 = makeProfile({ preferredLanguages: ["TypeScript", "Go"] });
    const p2 = makeProfile({
      userId: "user-2",
      preferredLanguages: ["TypeScript"],
    });
    const result = calculateMatchScore(p1, p2);
    expect(result.reasons.some((r) => r.includes("TypeScript"))).toBe(true);
  });

  it("scores session type overlap", () => {
    const p1 = makeProfile({ sessionTypes: ["teach-me", "build-together"] });
    const p2 = makeProfile({
      userId: "user-2",
      sessionTypes: ["build-together"],
    });
    const result = calculateMatchScore(p1, p2);
    expect(result.reasons.some((r) => r.includes("build-together"))).toBe(true);
  });

  it("gives timezone bonus for same timezone", () => {
    const p1 = makeProfile({ timezone: "America/New_York" });
    const p2 = makeProfile({ userId: "user-2", timezone: "America/New_York" });
    const withSameTz = calculateMatchScore(p1, p2);

    const p3 = makeProfile({ userId: "user-3", timezone: "Asia/Tokyo" });
    const withDiffTz = calculateMatchScore(p1, p3);

    expect(withSameTz.score).toBeGreaterThanOrEqual(withDiffTz.score);
  });

  it("scores availability overlap", () => {
    const avail = [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }];
    const p1 = makeProfile({ availability: avail });
    const p2 = makeProfile({ userId: "user-2", availability: avail });
    const result = calculateMatchScore(p1, p2);
    expect(result.reasons.some((r) => r.includes("availability"))).toBe(true);
  });

  it("penalizes empty skill profiles", () => {
    const p1 = makeProfile({
      skillsCanTeach: ["React"],
      preferredLanguages: ["TypeScript"],
    });
    const p2Full = makeProfile({
      userId: "user-2",
      skillsWantToLearn: ["React"],
      preferredLanguages: ["TypeScript"],
    });
    const p2Empty = makeProfile({
      userId: "user-3",
      skillsCanTeach: [],
      skillsWantToLearn: [],
      preferredLanguages: ["TypeScript"],
    });
    const fullScore = calculateMatchScore(p1, p2Full);
    const emptyScore = calculateMatchScore(p1, p2Empty);
    expect(fullScore.score).toBeGreaterThan(emptyScore.score);
  });

  it("caps score at 100", () => {
    const skills = ["React", "Vue", "Angular", "Svelte", "Next.js", "Nuxt"];
    const p1 = makeProfile({
      skillsCanTeach: skills,
      skillsWantToLearn: skills,
      preferredLanguages: ["TypeScript", "JavaScript", "Python"],
      preferredFrameworks: ["Express", "Fastify"],
      sessionTypes: ["teach-me", "build-together", "code-review"],
      availability: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
      ],
    });
    const p2 = makeProfile({
      userId: "user-2",
      skillsCanTeach: skills,
      skillsWantToLearn: skills,
      preferredLanguages: ["TypeScript", "JavaScript", "Python"],
      preferredFrameworks: ["Express", "Fastify"],
      sessionTypes: ["teach-me", "build-together", "code-review"],
      availability: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
      ],
    });
    const result = calculateMatchScore(p1, p2);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("getTopMatches", () => {
  it("excludes the user's own profile", async () => {
    const me = makeProfile({ userId: "me" });
    const profiles = [
      me,
      makeProfile({ userId: "other", skillsWantToLearn: ["React"] }),
    ];
    const matches = await getTopMatches(
      makeProfile({ userId: "me", skillsCanTeach: ["React"] }),
      profiles
    );
    expect(matches.every((m) => m.userId !== "me")).toBe(true);
  });

  it("excludes inactive profiles", async () => {
    const me = makeProfile({ userId: "me", skillsCanTeach: ["React"] });
    const inactive = makeProfile({
      userId: "inactive",
      isActive: false,
      skillsWantToLearn: ["React"],
    });
    const matches = await getTopMatches(me, [inactive]);
    expect(matches).toHaveLength(0);
  });

  it("returns matches sorted by score descending", async () => {
    const me = makeProfile({
      userId: "me",
      skillsCanTeach: ["React", "TypeScript"],
    });
    const lowMatch = makeProfile({
      userId: "low",
      skillsWantToLearn: ["React"],
    });
    const highMatch = makeProfile({
      userId: "high",
      skillsWantToLearn: ["React", "TypeScript"],
    });
    const matches = await getTopMatches(me, [lowMatch, highMatch]);
    expect(matches.length).toBe(2);
    expect(matches[0].userId).toBe("high");
  });

  it("respects the limit parameter", async () => {
    const me = makeProfile({ userId: "me", skillsCanTeach: ["React"] });
    const profiles = Array.from({ length: 20 }, (_, i) =>
      makeProfile({ userId: `user-${i}`, skillsWantToLearn: ["React"] })
    );
    const matches = await getTopMatches(me, profiles, 5);
    expect(matches.length).toBe(5);
  });

  it("excludes zero-score matches", async () => {
    const me = makeProfile({ userId: "me", timezone: "America/New_York" });
    const other = makeProfile({ userId: "other", timezone: "Asia/Tokyo" });
    // Different timezones + no skills = 0 score after empty profile penalty
    const matches = await getTopMatches(me, [other]);
    expect(matches).toHaveLength(0);
  });
});
