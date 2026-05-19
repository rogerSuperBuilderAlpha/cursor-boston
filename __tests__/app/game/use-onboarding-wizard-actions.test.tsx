/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { useOnboardingWizard } from "@/app/game/_components/onboarding/use-onboarding-wizard";
import type { ArmyTotals, LandCounts } from "@/app/game/_lib/dashboard-types";
import type { GamePlayer, MapTile } from "@/lib/game/types";

const user = {
  getIdToken: jest.fn().mockResolvedValue("token-u1"),
} as unknown as User;

const player: GamePlayer = {
  userId: "u1",
  displayName: "Tester",
  caste: "red",
  turnsRemaining: 100,
  turnsSpentTotal: 0,
  phase: "play",
  tilesExplored: 10,
  shieldUntil: new Date(0),
  shieldDropAtTurn: 100,
  productionSpellsActive: [],
  stats: {
    attacksWon: 0,
    attacksLost: 0,
    tilesHeld: 3,
    unitsAlive: 0,
  },
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const counts: LandCounts = {
  military: 1,
  food: 1,
  magic: 1,
  unassigned: 0,
  total: 3,
};

const army: ArmyTotals = {
  ground: 0,
  siege: 0,
  air: 0,
  total: 0,
};

const tiles: MapTile[] = [
  {
    tileId: "m1",
    ownerId: "u1",
    q: 0,
    r: 0,
    type: "military",
    units: { ground: 0, siege: 0, air: 0 },
    armedDefenseSpellId: null,
  },
  {
    tileId: "f1",
    ownerId: "u1",
    q: 1,
    r: 0,
    type: "food",
    units: { ground: 0, siege: 0, air: 0 },
    armedDefenseSpellId: null,
  },
  {
    tileId: "g1",
    ownerId: "u1",
    q: 0,
    r: 1,
    type: "magic",
    units: { ground: 0, siege: 0, air: 0 },
    armedDefenseSpellId: null,
  },
];

function setup(overrides?: {
  player?: GamePlayer | null;
  tiles?: MapTile[];
  onRefresh?: jest.Mock<Promise<void>, []>;
}) {
  const onRefresh = overrides?.onRefresh ?? jest.fn().mockResolvedValue(undefined);
  const hook = renderHook(() =>
    useOnboardingWizard({
      user,
      player: overrides?.player === undefined ? player : overrides.player,
      counts,
      army,
      tiles: overrides?.tiles ?? tiles,
      onRefresh,
    }),
  );
  return { ...hook, onRefresh };
}

describe("useOnboardingWizard actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as typeof fetch;
  });

  it("auto-opens, dismisses, explores, balances, picks caste, and recruits", async () => {
    const { result, onRefresh } = setup();

    await waitFor(() => expect(result.current.isOpen).toBe(true));

    act(() => result.current.dismiss());
    expect(result.current.isOpen).toBe(false);

    await act(async () => {
      await result.current.runExplore(2);
    });
    await act(async () => {
      await result.current.runAutoBalance();
    });
    await act(async () => {
      await result.current.pickCaste("blue");
    });
    await act(async () => {
      await result.current.runRecruit();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/game/setup/explore",
      expect.objectContaining({ method: "POST" }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/game/distribute/bulk",
      expect.objectContaining({ method: "POST" }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/game/setup/caste",
      expect.objectContaining({ method: "POST" }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/game/build",
      expect.objectContaining({ method: "POST" }),
    );
    expect(onRefresh).toHaveBeenCalled();
  });

  it("surfaces errors for missing military tile and failed explore", async () => {
    const { result } = setup({
      tiles: tiles.filter((tile) => tile.type !== "military"),
    });

    await act(async () => {
      await result.current.runRecruit();
    });
    expect(result.current.error).toMatch(/No military tile/i);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: { message: "fog jammed" } }),
    });

    await act(async () => {
      await result.current.runExplore(1);
    });
    expect(result.current.error).toMatch(/fog jammed/i);
  });
});
