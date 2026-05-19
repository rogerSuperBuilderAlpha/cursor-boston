/**
 * @jest-environment jsdom
 *
 * OpenSSF Silver — exercises useDashboardData mount fetch, auth gates,
 * and action handler wiring (dashboard-fetch + dashboard-actions mocked).
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { useDashboardData } from "@/app/game/_lib/use-dashboard-data";
import { fetchInitialData } from "@/app/game/_lib/dashboard-fetch";
import {
  adminGrant,
  armDefenseSpell,
  attack,
  bulkDistribute,
  castArmageddon,
  castIntelSpell,
  castSpell,
  createPlayer,
  distributeTile,
  farExpedition,
  flyover,
  frontierExplore,
  recruitUnits,
  setPlayerName,
  siege,
  spendArtifact,
} from "@/app/game/_lib/dashboard-actions";
import type { MapTile } from "@/lib/game/types";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/app/game/_lib/dashboard-fetch", () => ({
  fetchInitialData: jest.fn(),
}));

jest.mock("@/app/game/_lib/dashboard-actions", () => ({
  adminGrant: jest.fn(),
  armDefenseSpell: jest.fn(),
  attack: jest.fn(),
  bulkDistribute: jest.fn(),
  castArmageddon: jest.fn(),
  castIntelSpell: jest.fn(),
  castSpell: jest.fn(),
  createPlayer: jest.fn(),
  distributeTile: jest.fn(),
  farExpedition: jest.fn(),
  flyover: jest.fn(),
  frontierExplore: jest.fn(),
  recruitUnits: jest.fn(),
  setPlayerName: jest.fn(),
  siege: jest.fn(),
  spendArtifact: jest.fn(),
}));

import { useAuth } from "@/contexts/AuthContext";

const mockUseAuth = useAuth as jest.Mock;

const FAKE_TILE: MapTile = {
  tileId: "1_0",
  q: 1,
  r: 0,
  type: "military",
  ownerId: "u1",
  units: { ground: 1, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

function makeUser(uid = "u1") {
  return {
    uid,
    getIdToken: jest.fn().mockResolvedValue(`token-${uid}`),
  } as unknown as User;
}

describe("useDashboardData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
    });
    (fetchInitialData as jest.Mock).mockImplementation(async (_user, set) => {
      set.setPlayer(null);
      set.setTiles([]);
      set.setLoading(false);
    });
  });

  it("skips fetch and clears loading when signed out", async () => {
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(fetchInitialData).not.toHaveBeenCalled();
    expect(result.current.player).toBeNull();
  });

  it("calls fetchInitialData when a user is present", async () => {
    const user = makeUser();
    mockUseAuth.mockReturnValue({
      user,
      userProfile: null,
      loading: false,
    });

    renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(fetchInitialData).toHaveBeenCalledWith(
        user,
        expect.objectContaining({
          setPlayer: expect.any(Function),
          setTiles: expect.any(Function),
          setLoading: expect.any(Function),
        })
      );
    });
  });

  it("derives isAdmin from userProfile when server flag is false", async () => {
    mockUseAuth.mockReturnValue({
      user: makeUser(),
      userProfile: { isAdmin: true },
      loading: false,
    });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.isAdmin).toBe(true);
    });
  });

  it("hydrates player and tiles from fetchInitialData setters", async () => {
    const user = makeUser();
    mockUseAuth.mockReturnValue({ user, userProfile: null, loading: false });
    (fetchInitialData as jest.Mock).mockImplementation(async (_user, set) => {
      set.setPlayer({
        id: user.uid,
        displayName: "Hero",
        turnsRemaining: 3,
      } as never);
      set.setTiles([FAKE_TILE]);
      set.setServerIsAdmin(true);
      set.setLoading(false);
    });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.player?.displayName).toBe("Hero");
      expect(result.current.tiles).toHaveLength(1);
      expect(result.current.isAdmin).toBe(true);
    });
  });

  it("wires handleCreatePlayer to createPlayer and refetch", async () => {
    const user = makeUser();
    mockUseAuth.mockReturnValue({ user, userProfile: null, loading: false });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(fetchInitialData).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleCreatePlayer("Newbie");
    });

    expect(createPlayer).toHaveBeenCalledWith(
      user,
      "Newbie",
      expect.objectContaining({ setError: expect.any(Function) }),
      expect.any(Function)
    );
  });

  it("handleFrontierExplore delegates to frontierExplore", async () => {
    const user = makeUser();
    mockUseAuth.mockReturnValue({ user, userProfile: null, loading: false });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(fetchInitialData).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleFrontierExplore(2);
    });

    expect(frontierExplore).toHaveBeenCalledWith(
      user,
      2,
      expect.objectContaining({
        mergeOwnedTiles: expect.any(Function),
        setError: expect.any(Function),
      }),
      expect.any(Function)
    );
  });

  it("refresh triggers another fetchInitialData pass", async () => {
    const user = makeUser();
    mockUseAuth.mockReturnValue({ user, userProfile: null, loading: false });

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(fetchInitialData).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetchInitialData).toHaveBeenCalledTimes(2);
  });

  it("handleAttack delegates to attack action", async () => {
    const user = makeUser();
    mockUseAuth.mockReturnValue({ user, userProfile: null, loading: false });

    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(fetchInitialData).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleAttack({
        sourceTileId: "1_0",
        targetTileId: "2_0",
        units: { ground: 5, air: 0, siege: 0 },
        offenseSpellId: null,
      });
    });

    expect(attack).toHaveBeenCalled();
  });

  it("handleRecruit delegates to recruitUnits", async () => {
    const user = makeUser();
    mockUseAuth.mockReturnValue({ user, userProfile: null, loading: false });

    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(fetchInitialData).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleRecruit("1_0", "ground");
    });

    expect(recruitUnits).toHaveBeenCalled();
  });

  it("exposes explore count setter", async () => {
    mockUseAuth.mockReturnValue({
      user: makeUser(),
      userProfile: null,
      loading: false,
    });

    const { result } = renderHook(() => useDashboardData());

    act(() => {
      result.current.setExploreCount(4);
    });

    expect(result.current.exploreCount).toBe(4);
  });

  it("wires remaining dashboard action handlers", async () => {
    const user = makeUser();
    mockUseAuth.mockReturnValue({ user, userProfile: null, loading: false });

    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(fetchInitialData).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleSetName("General");
      await result.current.handleBulkDistribute(
        "food",
        1,
        () => true,
        "all",
      );
      await result.current.handleAdminGrant();
      await result.current.handleFarExpedition();
      await result.current.handleCastIntelSpell("red-intel-scout", "1_0");
      await result.current.handleArmDefenseSpell("1_0", "red-defense-fire-wall");
      await result.current.handleDistributeTile("1_0", "military");
      await result.current.handleUseArtifact("art-1", "1_0");
      await result.current.handleSiege("1_0", "2_0");
      await result.current.handleFlyover("1_0", "2_0", {
        ground: 1,
        air: 0,
        siege: 0,
      });
      await result.current.handleCastSpell(
        "red-offense-inferno",
        "1_0",
        "2_0",
      );
      await result.current.handleCastArmageddon();
    });

    expect(setPlayerName).toHaveBeenCalled();
    expect(bulkDistribute).toHaveBeenCalled();
    expect(adminGrant).toHaveBeenCalled();
    expect(farExpedition).toHaveBeenCalled();
    expect(castIntelSpell).toHaveBeenCalled();
    expect(armDefenseSpell).toHaveBeenCalled();
    expect(distributeTile).toHaveBeenCalled();
    expect(spendArtifact).toHaveBeenCalled();
    expect(siege).toHaveBeenCalled();
    expect(flyover).toHaveBeenCalled();
    expect(castSpell).toHaveBeenCalled();
    expect(castArmageddon).toHaveBeenCalled();
  });
});
