/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  createOrUpdateMentorshipProfileServer,
  getMentorshipMatchCandidatesServer,
} from "@/lib/mentorship/data-server";
import type { MentorshipProfile } from "@/lib/mentorship/types";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

const { getAdminDb } = jest.requireMock("@/lib/firebase-admin") as {
  getAdminDb: jest.Mock;
};

function makeProfile(overrides: Partial<MentorshipProfile> = {}): MentorshipProfile {
  return {
    userId: "seeker",
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

interface FakeQueryShape {
  where: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  get: jest.Mock;
}

/**
 * Build a chainable query fake whose .get() resolves to the given doc set.
 * Captures every .where() call so the test can assert query shape.
 */
function makeQuery(
  docs: Array<{ id: string; data: () => unknown }>
): { query: FakeQueryShape; whereCalls: unknown[][] } {
  const whereCalls: unknown[][] = [];
  const query: FakeQueryShape = {
    where: jest.fn((...args: unknown[]) => {
      whereCalls.push(args);
      return query;
    }),
    orderBy: jest.fn(() => query),
    limit: jest.fn(() => query),
    get: jest.fn(() => Promise.resolve({ docs })),
  };
  return { query, whereCalls };
}

describe("getMentorshipMatchCandidatesServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("queries by expertise overlap when seeker is a mentee", async () => {
    const seeker = makeProfile({
      role: "mentee",
      learningGoals: ["React", "TypeScript"],
    });
    const { query, whereCalls } = makeQuery([
      { id: "mentor-1", data: () => ({ userId: "mentor-1", role: "mentor", isActive: true, expertise: ["React"] }) },
    ]);
    getAdminDb.mockReturnValue({ collection: jest.fn(() => query) });

    const out = await getMentorshipMatchCandidatesServer(seeker);

    expect(out).toHaveLength(1);
    expect(out[0]?.userId).toBe("mentor-1");
    // Three .where() calls on a single query: isActive, role IN [mentor,both],
    // normalizedExpertise array-contains-any [react, typescript].
    expect(whereCalls).toEqual(
      expect.arrayContaining([
        ["isActive", "==", true],
        ["role", "in", ["mentor", "both"]],
        ["normalizedExpertise", "array-contains-any", ["react", "typescript"]],
      ])
    );
  });

  it("queries both directions for a 'both' seeker and dedupes", async () => {
    const seeker = makeProfile({
      role: "both",
      expertise: ["Python"],
      learningGoals: ["Rust"],
    });
    // Same candidate id appears in both query results — should dedupe.
    const dupDoc = {
      id: "candidate-1",
      data: () => ({ userId: "candidate-1", role: "both", isActive: true }),
    };
    const q1 = makeQuery([dupDoc]);
    const q2 = makeQuery([dupDoc]);
    let callIdx = 0;
    const collection = jest.fn(() => (callIdx++ === 0 ? q1.query : q2.query));
    getAdminDb.mockReturnValue({ collection });

    const out = await getMentorshipMatchCandidatesServer(seeker);

    expect(out).toHaveLength(1);
    expect(collection).toHaveBeenCalledTimes(2);
  });

  it("excludes the seeker from results", async () => {
    const seeker = makeProfile({ userId: "seeker", learningGoals: ["React"] });
    const { query } = makeQuery([
      { id: "seeker", data: () => ({ userId: "seeker" }) },
      { id: "other", data: () => ({ userId: "other" }) },
    ]);
    getAdminDb.mockReturnValue({ collection: jest.fn(() => query) });

    const out = await getMentorshipMatchCandidatesServer(seeker);
    expect(out.map((p) => p.userId)).toEqual(["other"]);
  });

  it("falls back to the active scan when seeker has no skills to match against", async () => {
    const seeker = makeProfile({
      role: "mentee",
      learningGoals: [],
      expertise: [],
    });
    const { query, whereCalls } = makeQuery([
      { id: "any-1", data: () => ({ userId: "any-1", isActive: true }) },
    ]);
    getAdminDb.mockReturnValue({ collection: jest.fn(() => query) });

    const out = await getMentorshipMatchCandidatesServer(seeker);

    expect(out).toHaveLength(1);
    // Fallback path uses isActive==true + orderBy + limit. No
    // array-contains-any.
    expect(whereCalls).toEqual([["isActive", "==", true]]);
    expect(query.orderBy).toHaveBeenCalledWith("updatedAt", "desc");
    expect(query.limit).toHaveBeenCalled();
  });

  it("returns [] when admin db is not configured", async () => {
    getAdminDb.mockReturnValue(null);
    const out = await getMentorshipMatchCandidatesServer(
      makeProfile({ learningGoals: ["React"] })
    );
    expect(out).toEqual([]);
  });

  it("normalizes the seeker's skills before querying", async () => {
    const seeker = makeProfile({
      role: "mentee",
      learningGoals: [" REACT ", "TypeScript", "react", ""],
    });
    const { query, whereCalls } = makeQuery([]);
    getAdminDb.mockReturnValue({ collection: jest.fn(() => query) });

    await getMentorshipMatchCandidatesServer(seeker);

    // Empty strings dropped, dupes collapsed, casing lowered.
    const containsCall = whereCalls.find(
      (c) => c[0] === "normalizedExpertise"
    );
    expect(containsCall?.[2]).toEqual(["react", "typescript"]);
  });
});

describe("createOrUpdateMentorshipProfileServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("denormalizes expertise + learningGoals on create", async () => {
    const docRef = {
      get: jest.fn(() => Promise.resolve({ exists: false })),
      set: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve()),
    };
    getAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => docRef) })),
    });

    await createOrUpdateMentorshipProfileServer("user-1", {
      role: "both",
      expertise: ["React", "TypeScript"],
      learningGoals: ["Go", "Rust"],
      preferredLanguages: ["en"],
      timezone: "America/New_York",
      availability: [],
      isActive: true,
    });

    expect(docRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedExpertise: ["react", "typescript"],
        normalizedLearningGoals: ["go", "rust"],
      })
    );
  });

  it("denormalizes on update too", async () => {
    const docRef = {
      get: jest.fn(() => Promise.resolve({ exists: true })),
      set: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve()),
    };
    getAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => docRef) })),
    });

    await createOrUpdateMentorshipProfileServer("user-1", {
      role: "mentor",
      expertise: ["GraphQL"],
      learningGoals: [],
      preferredLanguages: ["en"],
      timezone: "UTC",
      availability: [],
      isActive: true,
    });

    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedExpertise: ["graphql"],
        normalizedLearningGoals: [],
      })
    );
  });
});
