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
  isAdmin: false,
  player: null,
  tiles: [
    {
      tileId: "0_0",
      q: 0,
      r: 0,
      type: "military" as const,
      ownerId: "u1",
      units: { ground: 10, siege: 0, air: 0 },
      armedDefenseSpellId: null,
    },
  ],
  worldTiles: [],
  worldOwners: new Map(),
  eligibility: { eligible: true, reason: null },
  loading: false,
  creating: false,
  error: null,
  refresh: jest.fn(),
  exploring: false,
  exploreCount: 1,
  setExploreCount: jest.fn(),
  exploreProgress: null,
  handleFrontierExplore: jest.fn(),
  distributing: false,
  distributeType: "military" as const,
  setDistributeType: jest.fn(),
  distributeCount: 1,
  setDistributeCount: jest.fn(),
  distributeProgress: null,
  handleBulkDistribute: jest.fn(),
  recentReports: [],
  renaming: false,
  setRenaming: jest.fn(),
  renameInput: "",
  setRenameInput: jest.fn(),
  handleCreatePlayer: jest.fn(),
  handleSetName: jest.fn(),
  handleAdminGrant: jest.fn(),
  handleFarExpedition: jest.fn(),
  handleCastIntelSpell: jest.fn(),
  artifacts: [],
  handleAttack: jest.fn(),
  handleRecruit: jest.fn(),
  handleArmDefenseSpell: jest.fn(),
  handleDistributeTile: jest.fn(),
  handleUseArtifact: jest.fn(),
  handleSiege: jest.fn(),
  handleFlyover: jest.fn(),
  handleCastSpell: jest.fn(),
  worldMeta: null,
  topLeaders: [],
  handleCastArmageddon: jest.fn(),
};

describe("game dashboard page", () => {
  beforeEach(() => {
    const user = makeAuthUser("u1");
    mockUseAuth.mockReturnValue({
      user,
      loading: false,
    });
    mockUseDashboardData.mockReturnValue({
      ...baseDashboard,
      user,
      player: {
        userId: "u1",
        displayName: "Test General",
        phase: "play",
        caste: "red",
        turnsRemaining: 5,
        turnsSpentTotal: 10,
        shieldDropAtTurn: 0,
        stats: {
          tilesHeld: 10,
          unitsAlive: 20,
          attacksWon: 0,
          attacksLost: 0,
        },
        productionSpellsActive: [],
        activeUpgrades: {},
      },
    });
  });

  it("renders dashboard header for signed-in player", async () => {
    const Page = (await import("@/app/game/page")).default;
    const { getByText } = render(<Page />);
    await waitFor(() => {
      expect(getByText("Test General")).toBeInTheDocument();
      expect(getByText(/Turns remaining/i)).toBeInTheDocument();
    });
  });
});
