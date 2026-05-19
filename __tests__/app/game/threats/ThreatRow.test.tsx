/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen } from "@testing-library/react";
import { ThreatRow } from "@/app/game/threats/_components/ThreatRow";
import type { ThreatEntry } from "@/app/game/threats/_lib/threats-derive";
import type { MapTile } from "@/lib/game/types";
import { BASE_PLAYER } from "@/__tests__/_helpers/game-mutation-db";

jest.mock("@/app/game/threats/_lib/use-attack-preview", () => ({
  useAttackPreview: () => ({ preview: null, loading: false, error: null }),
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

const noopAsync = async () => null;

describe("ThreatRow", () => {
  it("renders enemy display name when collapsed", () => {
    render(
      <ThreatRow
        entry={entry}
        player={{
          ...BASE_PLAYER,
          userId: "u1",
          caste: "red",
          phase: "play",
        }}
        artifacts={[]}
        busy={false}
        myMagicLandCount={2}
        onAttack={noopAsync}
        onBattleResolved={jest.fn()}
        onCastIntelSpell={noopAsync}
        onUseArtifact={noopAsync}
        onRecruit={noopAsync}
        onArmDefenseSpell={noopAsync}
        onDistributeTile={noopAsync}
        onSiege={noopAsync}
        onFlyover={noopAsync}
        onCastSpell={noopAsync}
      />,
    );
    expect(screen.getByText(/Rival/i)).toBeInTheDocument();
  });

  it("renders expanded attack controls when defaultExpanded", () => {
    render(
      <ThreatRow
        entry={entry}
        player={{
          ...BASE_PLAYER,
          userId: "u1",
          caste: "red",
          phase: "play",
        }}
        artifacts={[]}
        busy={false}
        defaultExpanded
        myMagicLandCount={2}
        onAttack={noopAsync}
        onBattleResolved={jest.fn()}
        onCastIntelSpell={noopAsync}
        onUseArtifact={noopAsync}
        onRecruit={noopAsync}
        onArmDefenseSpell={noopAsync}
        onDistributeTile={noopAsync}
        onSiege={noopAsync}
        onFlyover={noopAsync}
        onCastSpell={noopAsync}
      />,
    );
    expect(screen.getByText(/Rival/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /attack/i })).toBeInTheDocument();
  });

});
