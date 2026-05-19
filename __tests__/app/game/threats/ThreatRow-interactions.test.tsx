/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThreatRow } from "@/app/game/threats/_components/ThreatRow";
import type { ThreatEntry } from "@/app/game/threats/_lib/threats-derive";
import type { MapTile } from "@/lib/game/types";
import { BASE_PLAYER } from "@/__tests__/_helpers/game-mutation-db";

jest.mock("@/app/game/threats/_lib/use-attack-preview", () => ({
  useAttackPreview: () => ({
    preview: {
      combat: { outcome: "captured", attackerWins: true },
      defender: { userId: "u2" },
    },
    loading: false,
    error: null,
  }),
}));

jest.mock("@/app/game/threats/_components/BattleSimPanel", () => ({
  BattleSimPanel: () => null,
}));
jest.mock("@/app/game/threats/_components/BoostPanel", () => ({
  BoostPanel: () => null,
}));
jest.mock("@/app/game/threats/_components/ChangeSourceModal", () => ({
  ChangeSourceModal: () => null,
}));
jest.mock("@/app/game/threats/_components/ManageSourcePanel", () => ({
  ManageSourcePanel: () => null,
}));
jest.mock("@/app/game/threats/_components/SourceTileCard", () => ({
  SourceTileCard: () => null,
}));
jest.mock("@/app/game/threats/_components/SpellPicker", () => ({
  SpellPicker: () => null,
}));

const sourceTile: MapTile = {
  tileId: "0_0",
  q: 0,
  r: 0,
  type: "military",
  ownerId: "u1",
  units: { ground: 10, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

const enemyTile: MapTile = {
  tileId: "1_0",
  q: 1,
  r: 0,
  type: "military",
  ownerId: "u2",
  units: { ground: 3, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

const entry: ThreatEntry = {
  enemyTile,
  enemyOwner: {
    userId: "u2",
    displayName: "Rival",
    caste: "blue",
    shielded: false,
    isNpc: false,
  },
  candidateSources: [sourceTile],
  bestSource: sourceTile,
  bestSourceStrength: 10,
  bestSourceSupply: 1,
  myAdvantage: 3.33,
};

const rowProps = {
  entry,
  player: { ...BASE_PLAYER, userId: "u1", caste: "red" as const, phase: "play" as const },
  artifacts: [],
  busy: false,
  myMagicLandCount: 2,
  onAttack: jest.fn().mockResolvedValue(null),
  onBattleResolved: jest.fn(),
  onCastIntelSpell: jest.fn().mockResolvedValue(null),
  onUseArtifact: jest.fn().mockResolvedValue(null),
  onRecruit: jest.fn().mockResolvedValue(null),
  onArmDefenseSpell: jest.fn().mockResolvedValue(null),
  onDistributeTile: jest.fn().mockResolvedValue(null),
  onSiege: jest.fn().mockResolvedValue(null),
  onFlyover: jest.fn().mockResolvedValue(null),
  onCastSpell: jest.fn().mockResolvedValue(null),
};

describe("ThreatRow interactions", () => {
  it("expands row and switches to defense tab", async () => {
    const user = userEvent.setup();
    render(<ThreatRow {...rowProps} />);

    const expandBtn = screen.getByRole("button", { name: /expand row/i });
    await user.click(expandBtn);

    const defenseTab = screen.getByRole("tab", { name: /Defense/i });
    await user.click(defenseTab);

    expect(screen.getByText(/Rival/i)).toBeInTheDocument();
  });

  it("shows attack button when defaultExpanded", () => {
    render(<ThreatRow {...rowProps} defaultExpanded />);
    expect(screen.getByRole("button", { name: /attack/i })).toBeInTheDocument();
  });
});
