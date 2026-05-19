/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { GamePlayer, MapTile } from "@/lib/game/types";
import { useRecruitAction } from "@/app/game/recruit/_lib/use-recruit-action";

jest.mock("@/lib/game/local-map-cache", () => ({
  mergeTiles: jest.fn(),
}));

import { mergeTiles } from "@/lib/game/local-map-cache";

const mockMergeTiles = mergeTiles as jest.Mock;

function makeUser() {
  return {
    uid: "recruit-u",
    getIdToken: jest.fn().mockResolvedValue("recruit-token"),
  } as unknown as User;
}

const basePlayer = {
  userId: "recruit-u",
  displayName: "Recruiter",
  caste: "red" as const,
  turnsRemaining: 5,
  turnsSpentTotal: 0,
  phase: "play" as const,
  tilesExplored: 1,
  shieldUntil: new Date(),
  shieldDropAtTurn: 0,
  productionSpellsActive: [],
  stats: { attacksWon: 0, attacksLost: 0, tilesHeld: 1, unitsAlive: 1 },
} satisfies Partial<GamePlayer> as GamePlayer;

const updatedTile: MapTile = {
  tileId: "0_0",
  q: 0,
  r: 0,
  type: "military",
  ownerId: "recruit-u",
  units: { ground: 10, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

describe("useRecruitAction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  function mountHook(user: User | null = makeUser()) {
    const setError = jest.fn();
    const setPlayer = jest.fn();
    const setTiles = jest.fn();
    const hook = renderHook(() =>
      useRecruitAction({ user, setError, setPlayer, setTiles }),
    );
    return { ...hook, setError, setPlayer, setTiles };
  }

  it("sets error when totalCycles is zero", async () => {
    const { result, setError } = mountHook();

    await act(async () => {
      await result.current.handleRecruit({
        unitType: "ground",
        totalCycles: 0,
        selectedTileId: "0_0",
        threatRankedRecruitableIds: ["0_0"],
      });
    });

    expect(setError).toHaveBeenCalledWith(
      "Not enough turns or capacity to recruit any units.",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("posts bulk plan for selected tile and merges response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        produced: 12,
        reports: [{ artifactFound: true }, { artifactFound: false }],
        player: basePlayer,
        tiles: [updatedTile],
      }),
    });

    const { result, setPlayer, setTiles } = mountHook();

    await act(async () => {
      await result.current.handleRecruit({
        unitType: "ground",
        totalCycles: 2,
        selectedTileId: "0_0",
        threatRankedRecruitableIds: ["0_0", "1_0"],
      });
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/build/bulk",
        expect.objectContaining({
          body: JSON.stringify({
            plan: [{ tileId: "0_0", unitType: "ground", cycles: 2 }],
          }),
        }),
      );
      expect(setPlayer).toHaveBeenCalledWith(basePlayer);
      expect(setTiles).toHaveBeenCalled();
      expect(mockMergeTiles).toHaveBeenCalledWith("recruit-u", [updatedTile]);
    });
  });

  it("surfaces stopped-early partial failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        reports: [{ artifactFound: false }],
        stoppedEarly: "capacity reached",
      }),
    });

    const { result, setError } = mountHook();

    await act(async () => {
      await result.current.handleRecruit({
        unitType: "siege",
        totalCycles: 3,
        selectedTileId: "",
        threatRankedRecruitableIds: ["0_0", "1_0"],
      });
    });

    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith(
        "Stopped early after 1 / 3: capacity reached",
      );
    });
  });

  it("handles API failure message", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ success: false, error: { message: "No military tiles" } }),
    });

    const { result, setError } = mountHook();

    await act(async () => {
      await result.current.handleRecruit({
        unitType: "air",
        totalCycles: 1,
        selectedTileId: "0_0",
        threatRankedRecruitableIds: [],
      });
    });

    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith("No military tiles");
    });
  });
});
