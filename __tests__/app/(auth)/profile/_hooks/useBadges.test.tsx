/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { ProfileDataApiResponse } from "@/lib/profile-data-types";
import { useBadges } from "@/app/(auth)/profile/_hooks/useBadges";
import { evaluateBadgeEligibility } from "@/lib/badges/eligibility";
import { ensureUserBadgesForEligibleWithStatus } from "@/lib/badges/data";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";

jest.mock("@/lib/badges/eligibility", () => ({
  evaluateBadgeEligibility: jest.fn(() => ({ profile_complete: true })),
}));

jest.mock("@/lib/badges/data", () => ({
  ensureUserBadgesForEligibleWithStatus: jest.fn(),
}));

const mockEvaluate = evaluateBadgeEligibility as jest.MockedFunction<
  typeof evaluateBadgeEligibility
>;
const mockEnsureBadges = ensureUserBadgesForEligibleWithStatus as jest.MockedFunction<
  typeof ensureUserBadgesForEligibleWithStatus
>;

const mockUser = { uid: "badge-user" } as unknown as User;

const profileBundle: ProfileDataApiResponse = {
  stats: {
    eventsRegistered: 0,
    eventsAttended: 0,
    talksSubmitted: 0,
    talksGiven: 0,
    pullRequestsCount: 0,
  },
  registrations: [],
  talks: [],
  badgeEligibility: {
    input: { hasDisplayName: true },
    status: { state: "ready", isAuthoritative: true, failedSources: [] },
  },
  userBadgeMap: { early_adopter: { earnedAt: "2026-01-01" } },
};

describe("useBadges", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockEnsureBadges.mockResolvedValue({
      userBadgeMap: { early_adopter: { earnedAt: "2026-01-01" } },
      status: { state: "complete" },
    });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("clears badge state when user is null", async () => {
    const { result } = renderHook(() => useBadges(null, null, null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.eligibilityMap).toBeUndefined();
    expect(result.current.userBadgeMap).toEqual({});
    expect(result.current.dataStatus.state).toBe("failed");
  });

  it("waits for profile bundle before evaluating eligibility", async () => {
    const { result, rerender } = renderHook(
      ({ bundle }: { bundle: ProfileDataApiResponse | null }) =>
        useBadges(mockUser, null, bundle),
      { initialProps: { bundle: null as ProfileDataApiResponse | null } },
    );

    expect(result.current.loading).toBe(true);

    rerender({ bundle: profileBundle });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockEvaluate).toHaveBeenCalledWith(profileBundle.badgeEligibility.input);
    expect(mockEnsureBadges).toHaveBeenCalledWith(
      mockUser.uid,
      { profile_complete: true },
      profileBundle.userBadgeMap,
    );
    expect(result.current.earnedIds.length).toBeGreaterThanOrEqual(0);
  });

  it("loads remote definitions when the API succeeds", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        definitions: [
          { id: "remote", name: "Remote", description: "d", category: "community" },
        ],
        source: "firestore",
      }),
    });

    const { result } = renderHook(() =>
      useBadges(mockUser, null, profileBundle),
    );

    await waitFor(() => {
      expect(result.current.definitions).toEqual([
        expect.objectContaining({ id: "remote" }),
      ]);
    });
    expect(result.current.usingFallback).toBe(false);
  });

  it("falls back when definitions fetch fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    const { result } = renderHook(() =>
      useBadges(mockUser, null, profileBundle),
    );

    await waitFor(() => {
      expect(result.current.usingFallback).toBe(true);
    });
    expect(result.current.definitions).toEqual(BADGE_DEFINITIONS);
  });

  it("marks fallback when API returns seeded definitions", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        definitions: BADGE_DEFINITIONS,
        source: "seeded-fallback",
      }),
    });

    const { result } = renderHook(() =>
      useBadges(mockUser, null, profileBundle),
    );

    await waitFor(() => {
      expect(result.current.usingFallback).toBe(true);
    });
  });

  it("handles evaluation errors with failed persistence status", async () => {
    mockEnsureBadges.mockRejectedValue(new Error("firestore down"));

    const { result } = renderHook(() =>
      useBadges(mockUser, null, profileBundle),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.dataStatus.state).toBe("failed");
    expect(result.current.persistenceStatus.state).toBe("failed");
    expect(mockEvaluate).toHaveBeenCalledWith({});
  });

  it("keeps local definitions when fetch throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() =>
      useBadges(mockUser, null, profileBundle),
    );

    await waitFor(() => {
      expect(result.current.usingFallback).toBe(true);
    });
  });
});
