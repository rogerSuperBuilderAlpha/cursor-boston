/**
 * @jest-environment node
 */

import { getBadgeEligibilityData } from "@/lib/badges/getBadgeEligibilityInput";
import { getUserStats } from "@/lib/registrations";
import { getDocs } from "firebase/firestore";

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

jest.mock("@/lib/registrations", () => ({
  getUserStats: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((db: unknown, name: string) => ({ __collection: name })),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  query: jest.fn((collectionRef: { __collection: string }, ...filters: unknown[]) => ({
    __collection: collectionRef.__collection,
    __filters: filters,
  })),
  getDocs: jest.fn(),
}));

const mockGetUserStats = getUserStats as jest.MockedFunction<typeof getUserStats>;
const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;

function snapshot(size: number, docs: Array<Record<string, unknown>> = []) {
  return {
    size,
    docs: docs.map((data) => ({
      data: () => data,
    })),
  };
}

describe("getBadgeEligibilityData contributor trust alignment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not use profile-derived pullRequestsCount when merged PR evidence is absent", async () => {
    mockGetUserStats.mockResolvedValue({
      eventsRegistered: 0,
      eventsAttended: 0,
      talksSubmitted: 0,
      talksGiven: 0,
      pullRequestsCount: 99,
    });

    mockGetDocs.mockImplementation(async (ref: unknown) => {
      const collectionName = (ref as { __collection?: string }).__collection;
      if (collectionName === "pullRequests") {
        return snapshot(0);
      }
      return snapshot(0);
    });

    const result = await getBadgeEligibilityData({
      uid: "u1",
      displayName: "Member",
    });

    expect(result.input.pullRequestsCount).toBe(0);
  });

  it("uses merged PR evidence for pullRequestsCount", async () => {
    mockGetUserStats.mockResolvedValue({
      eventsRegistered: 0,
      eventsAttended: 0,
      talksSubmitted: 0,
      talksGiven: 0,
      pullRequestsCount: 0,
    });

    mockGetDocs.mockImplementation(async (ref: unknown) => {
      const collectionName = (ref as { __collection?: string }).__collection;
      if (collectionName === "pullRequests") {
        return snapshot(2, [{ state: "merged" }, { state: "merged" }]);
      }
      return snapshot(0);
    });

    const result = await getBadgeEligibilityData({
      uid: "u2",
      displayName: "Member",
    });

    expect(result.input.pullRequestsCount).toBe(2);
  });
});
