/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen } from "@testing-library/react";
import {
  OwnTilePanel,
  EnemyTilePanel,
  Stat,
} from "@/app/game/tiles/_components/tile-action-panels";
import { BASE_PLAYER } from "@/__tests__/_helpers/game-mutation-db";

jest.mock("@/app/game/threats/_lib/use-attack-preview", () => ({
  useAttackPreview: () => ({ preview: null, loading: false, error: null }),
}));
jest.mock("@/app/game/threats/_components/BattleSimPanel", () => ({
  BattleSimPanel: () => null,
}));
jest.mock("@/app/game/_components/CatalogImage", () => ({
  CatalogImage: () => null,
}));

const tile = {
  tileId: "0_0",
  q: 0,
  r: 0,
  type: "military" as const,
  ownerId: "u1",
  units: { ground: 5, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

const player = {
  ...BASE_PLAYER,
  userId: "u1",
  caste: "red" as const,
  phase: "play" as const,
  turnsRemaining: 8,
};

describe("tile-action-panels", () => {
  it("Stat renders label and value", () => {
    render(<Stat label="Owner" value="You" />);
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("OwnTilePanel shows recruit controls", () => {
    render(
      <OwnTilePanel
        tile={tile}
        player={player}
        myDefenseSpells={[]}
        artifacts={[]}
        busy={false}
        onBuild={jest.fn()}
        onArmSpell={jest.fn()}
        onAssign={jest.fn()}
        onUseArtifact={jest.fn()}
      />,
    );
    expect(screen.getByText(/ground/i)).toBeInTheDocument();
  });

  it("EnemyTilePanel shows enemy tile type", () => {
    render(
      <EnemyTilePanel
        tile={{
          ...tile,
          tileId: "1_0",
          q: 1,
          r: 0,
          ownerId: "u2",
          units: { ground: 2, siege: 0, air: 0 },
        }}
        player={player}
        ownedTiles={[tile]}
        artifacts={[]}
        busy={false}
        onAttack={jest.fn()}
        onSpy={jest.fn()}
        onUseArtifact={jest.fn()}
      />,
    );
    expect(screen.getByText(/Launch attack/i)).toBeInTheDocument();
  });
});
