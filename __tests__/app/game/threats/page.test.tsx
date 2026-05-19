/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from "@/app/game/_lib/use-dashboard-data";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

jest.mock("@/app/game/_lib/use-dashboard-data", () => ({
  useDashboardData: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseDashboardData = useDashboardData as jest.Mock;

const baseDashboard = {
  user: null as ReturnType<typeof makeAuthUser> | null,
  authLoading: false,
  player: {
    userId: "u1",
    phase: "play",
    caste: "red",
    turnsRemaining: 5,
    stats: { tilesHeld: 10, unitsAlive: 20 },
  },
  tiles: [
    {
      tileId: "0_0",
      q: 0,
      r: 0,
      type: "military",
      ownerId: "u1",
      units: { ground: 10, siege: 0, air: 0 },
      armedDefenseSpellId: null,
    },
    {
      tileId: "1_0",
      q: 1,
      r: 0,
      type: "military",
      ownerId: "u2",
      units: { ground: 2, siege: 0, air: 0 },
      armedDefenseSpellId: null,
    },
  ],
  worldTiles: [],
  worldOwners: new Map(),
  artifacts: [],
  loading: false,
  error: null,
  busy: false,
  handleAttack: jest.fn(),
  handleRecruit: jest.fn(),
  handleCastIntelSpell: jest.fn(),
  handleUseArtifact: jest.fn(),
  handleArmDefenseSpell: jest.fn(),
  handleDistributeTile: jest.fn(),
  handleSiege: jest.fn(),
  handleFlyover: jest.fn(),
  handleCastSpell: jest.fn(),
  refresh: jest.fn(),
};

describe("game threats page", () => {
  beforeEach(() => {
    const user = makeAuthUser("u1");
    mockUseAuth.mockReturnValue({
      user,
      loading: false,
    });
    mockUseDashboardData.mockReturnValue({
      ...baseDashboard,
      user,
      worldTiles: baseDashboard.tiles,
      worldOwners: new Map([
        [
          "u2",
          {
            userId: "u2",
            displayName: "Enemy",
            caste: "blue",
            shielded: false,
            isNpc: false,
          },
        ],
      ]),
    });
  });

  it("renders threat list heading", async () => {
    const Page = (await import("@/app/game/threats/page")).default;
    const { getByText } = render(<Page />);
    await waitFor(() => {
      expect(getByText(/threats/i)).toBeInTheDocument();
    });
  });
});
