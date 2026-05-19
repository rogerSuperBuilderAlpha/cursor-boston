/**
 * @jest-environment node
 */

import {
  getBadgeEligibilityData,
  getBadgeEligibilityInput,
  getBaseBadgeEligibilityInput,
  buildBadgeDataStatus,
} from "@/lib/badges/getBadgeEligibilityInput";
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
  limit: jest.fn((n: number) => ({ __limit: n })),
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

  it("getBaseBadgeEligibilityInput maps profile fields correctly", () => {
    const input = getBaseBadgeEligibilityInput({
      displayName: "  Alice  ",
      visibility: { isPublic: true },
      bio: " bio text ",
      photoURL: "https://example.com/a.png",
      discord: { id: "1" },
      github: { login: "alice" },
    });
    expect(input.hasDisplayName).toBe(true);
    expect(input.isPublicProfile).toBe(true);
    expect(input.hasBio).toBe(true);
    expect(input.hasAvatar).toBe(true);
    expect(input.hasDiscordConnected).toBe(true);
    expect(input.hasGithubConnected).toBe(true);
    expect(input.eventsAttendedCount).toBe(0);
    expect(input.pullRequestsCount).toBe(0);
  });

  it("getBaseBadgeEligibilityInput returns false flags for missing fields", () => {
    const input = getBaseBadgeEligibilityInput({});
    expect(input.hasDisplayName).toBe(false);
    expect(input.isPublicProfile).toBe(false);
    expect(input.hasBio).toBe(false);
    expect(input.hasAvatar).toBe(false);
    expect(input.hasDiscordConnected).toBe(false);
    expect(input.hasGithubConnected).toBe(false);
  });

  it("getBaseBadgeEligibilityInput treats whitespace-only displayName as missing", () => {
    const input = getBaseBadgeEligibilityInput({ displayName: "   " });
    expect(input.hasDisplayName).toBe(false);
  });

  it("buildBadgeDataStatus: all ok → complete + authoritative", () => {
    const status = buildBadgeDataStatus({
      stats: "ok",
      showcaseSubmissions: "ok",
      communityMessages: "ok",
      pullRequests: "ok",
      hackathonParticipation: "ok",
    });
    expect(status.state).toBe("complete");
    expect(status.isAuthoritative).toBe(true);
    expect(status.failedSources).toEqual([]);
  });

  it("buildBadgeDataStatus: all error → failed + non-authoritative with message", () => {
    const status = buildBadgeDataStatus({
      stats: "error",
      showcaseSubmissions: "error",
      communityMessages: "error",
      pullRequests: "error",
      hackathonParticipation: "error",
    });
    expect(status.state).toBe("failed");
    expect(status.isAuthoritative).toBe(false);
    expect(status.failedSources).toHaveLength(5);
    expect(status.message).toContain("unavailable");
  });

  it("buildBadgeDataStatus: some ok + some error → partial", () => {
    const status = buildBadgeDataStatus({
      stats: "ok",
      showcaseSubmissions: "error",
      communityMessages: "ok",
      pullRequests: "error",
      hackathonParticipation: "ok",
    });
    expect(status.state).toBe("partial");
    expect(status.isAuthoritative).toBe(false);
    expect(status.failedSources).toEqual(["showcaseSubmissions", "pullRequests"]);
  });

  it("returns base shape with all errors when uid is empty", async () => {
    const result = await getBadgeEligibilityData({ uid: "" });
    expect(result.status.state).toBe("failed");
    expect(result.status.failedSources).toHaveLength(5);
    expect(mockGetUserStats).not.toHaveBeenCalled();
  });

  it("logs and continues when getUserStats throws", async () => {
    mockGetUserStats.mockRejectedValueOnce(new Error("firestore down"));
    mockGetDocs.mockResolvedValue(snapshot(0));
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const result = await getBadgeEligibilityData({ uid: "u3" });
    expect(result.status.failedSources).toContain("stats");
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it("loads stats successfully and stamps eventsAttendedCount/talksGivenCount", async () => {
    mockGetUserStats.mockResolvedValue({
      eventsRegistered: 2,
      eventsAttended: 3,
      talksSubmitted: 1,
      talksGiven: 2,
      pullRequestsCount: 0,
    });
    mockGetDocs.mockResolvedValue(snapshot(0));
    const result = await getBadgeEligibilityData({ uid: "u4" });
    expect(result.input.eventsAttendedCount).toBe(3);
    expect(result.input.talksGivenCount).toBe(2);
    expect(result.input.talksSubmittedCount).toBe(1);
  });

  it("only counts approved showcaseSubmissions", async () => {
    mockGetUserStats.mockResolvedValue({
      eventsRegistered: 0,
      eventsAttended: 0,
      talksSubmitted: 0,
      talksGiven: 0,
      pullRequestsCount: 0,
    });
    mockGetDocs.mockImplementation(async (ref: unknown) => {
      const collectionName = (ref as { __collection?: string }).__collection;
      if (collectionName === "showcaseSubmissions") {
        return snapshot(3, [
          { status: "approved" },
          { status: "pending" },
          { status: "approved" },
        ]);
      }
      return snapshot(0);
    });
    const result = await getBadgeEligibilityData({ uid: "u5" });
    expect(result.input.showcaseSubmissionsCount).toBe(2);
  });

  it("counts community messages and posts (no parentId means it's a top-level post)", async () => {
    mockGetUserStats.mockResolvedValue({
      eventsRegistered: 0,
      eventsAttended: 0,
      talksSubmitted: 0,
      talksGiven: 0,
      pullRequestsCount: 0,
    });
    mockGetDocs.mockImplementation(async (ref: unknown) => {
      const collectionName = (ref as { __collection?: string }).__collection;
      if (collectionName === "communityMessages") {
        return snapshot(3, [
          { parentId: null }, // top-level post
          { parentId: "parent-1" }, // reply
          {}, // top-level (no parentId at all)
        ]);
      }
      return snapshot(0);
    });
    const result = await getBadgeEligibilityData({ uid: "u6" });
    expect(result.input.communityMessagesCount).toBe(3);
    expect(result.input.communityPostsCount).toBe(2);
  });

  it("uses max(teams, pool) for hackathonParticipationCount", async () => {
    mockGetUserStats.mockResolvedValue({
      eventsRegistered: 0,
      eventsAttended: 0,
      talksSubmitted: 0,
      talksGiven: 0,
      pullRequestsCount: 0,
    });
    mockGetDocs.mockImplementation(async (ref: unknown) => {
      const collectionName = (ref as { __collection?: string }).__collection;
      if (collectionName === "hackathonTeams") return snapshot(2);
      if (collectionName === "hackathonPool") return snapshot(5);
      return snapshot(0);
    });
    const result = await getBadgeEligibilityData({ uid: "u7" });
    expect(result.input.hackathonParticipationCount).toBe(5);
  });

  it("logs and continues when any firestore query throws", async () => {
    mockGetUserStats.mockResolvedValue({
      eventsRegistered: 0,
      eventsAttended: 0,
      talksSubmitted: 0,
      talksGiven: 0,
      pullRequestsCount: 0,
    });
    mockGetDocs.mockImplementation(async (ref: unknown) => {
      const collectionName = (ref as { __collection?: string }).__collection;
      if (collectionName === "pullRequests") throw new Error("permission denied");
      return snapshot(0);
    });
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const result = await getBadgeEligibilityData({ uid: "u8" });
    expect(result.status.failedSources).toContain("pullRequests");
    expect(result.status.state).toBe("partial");
    consoleWarnSpy.mockRestore();
  });

  it("getBadgeEligibilityInput delegates to getBadgeEligibilityData", async () => {
    mockGetUserStats.mockResolvedValue({
      eventsRegistered: 0,
      eventsAttended: 0,
      talksSubmitted: 0,
      talksGiven: 0,
      pullRequestsCount: 0,
    });
    mockGetDocs.mockResolvedValue(snapshot(0));
    const input = await getBadgeEligibilityInput({ uid: "u9" });
    expect(input).toBeDefined();
    expect(input.eventsAttendedCount).toBe(0);
  });
});
