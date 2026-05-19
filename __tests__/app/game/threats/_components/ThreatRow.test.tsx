/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThreatRow } from "@/app/game/threats/_components/ThreatRow";
import type { ThreatEntry } from "@/app/game/threats/_lib/threats-derive";
import type { GameArtifact, MapTile } from "@/lib/game/types";
import { BASE_PLAYER } from "@/__tests__/_helpers/game-mutation-db";

jest.mock("@/app/game/threats/_lib/use-attack-preview", () => ({
  useAttackPreview: () => ({
    preview: { combat: { outcome: "captured" } },
    loading: false,
    error: null,
  }),
}));

jest.mock("@/app/game/threats/_components/BattleSimPanel", () => ({
  BattleSimPanel: () => <div data-testid="battle-sim" />,
}));

jest.mock("@/app/game/threats/_components/BoostPanel", () => ({
  BoostPanel: ({
    onQueueArtifact,
    onUseIntelArtifact,
    spy,
    siege,
    flyover,
    offensiveArtifacts,
    intelArtifacts,
  }: {
    onQueueArtifact: (id: string) => void;
    onUseIntelArtifact: (id: string) => void;
    spy?: { onClick: () => void };
    siege?: { onClick: () => void };
    flyover?: { onClick: () => void };
    offensiveArtifacts: { artifact: { id: string } }[];
    intelArtifacts: { artifact: { id: string } }[];
  }) => (
    <div>
      {offensiveArtifacts[0] ? (
        <button type="button" onClick={() => onQueueArtifact(offensiveArtifacts[0]!.artifact.id)}>
          Queue offense artifact
        </button>
      ) : null}
      {intelArtifacts[0] ? (
        <button type="button" onClick={() => onUseIntelArtifact(intelArtifacts[0]!.artifact.id)}>
          Use intel artifact
        </button>
      ) : null}
      {spy ? (
        <button type="button" onClick={spy.onClick}>
          Cast intel spell
        </button>
      ) : null}
      {siege ? (
        <button type="button" onClick={siege.onClick}>
          Siege
        </button>
      ) : null}
      {flyover ? (
        <button type="button" onClick={flyover.onClick}>
          Flyover
        </button>
      ) : null}
    </div>
  ),
}));

jest.mock("@/app/game/threats/_components/ChangeSourceModal", () => ({
  ChangeSourceModal: ({
    onSelect,
    onClose,
  }: {
    onSelect: (id: string) => void;
    onClose: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSelect("alt_0")}>
        Pick alt source
      </button>
      <button type="button" onClick={onClose}>
        Close source modal
      </button>
    </div>
  ),
}));

jest.mock("@/app/game/threats/_components/ManageSourcePanel", () => ({
  ManageSourcePanel: ({
    onAssign,
    onRecruit,
    onArmDefenseSpell,
    onUseDefensiveArtifact,
  }: {
    onAssign: (t: string) => void;
    onRecruit: (u: string) => void;
    onArmDefenseSpell: (id: string) => void;
    onUseDefensiveArtifact: (id: string) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onAssign("food")}>
        Assign food
      </button>
      <button type="button" onClick={() => onRecruit("ground")}>
        Recruit ground defense
      </button>
      <button type="button" onClick={() => onArmDefenseSpell("red-shield")}>
        Arm defense spell
      </button>
      <button type="button" onClick={() => onUseDefensiveArtifact("def-art-1")}>
        Use defense artifact
      </button>
    </div>
  ),
}));

jest.mock("@/app/game/threats/_components/SourceTileCard", () => ({
  SourceTileCard: ({ onOpenPicker }: { onOpenPicker: () => void }) => (
    <button type="button" onClick={onOpenPicker}>
      Change source
    </button>
  ),
}));

jest.mock("@/app/game/threats/_components/SpellPicker", () => ({
  SpellPicker: ({
    onSelect,
  }: {
    onSelect: (id: string) => void;
  }) => (
    <button type="button" onClick={() => onSelect("red-offense-inferno")}>
      Pick offense spell
    </button>
  ),
}));

const sourceTile: MapTile = {
  tileId: "0_0",
  q: 0,
  r: 0,
  type: "military",
  ownerId: "u1",
  units: { ground: 10, siege: 2, air: 3 },
  baseUnits: { ground: 0, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

const altSource: MapTile = {
  tileId: "alt_0",
  q: -1,
  r: 0,
  type: "military",
  ownerId: "u1",
  units: { ground: 5, siege: 0, air: 0 },
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
  candidateSources: [sourceTile, altSource],
  bestSource: sourceTile,
  bestSourceStrength: 10,
  bestSourceSupply: 1,
  myAdvantage: 3.33,
};

const artifactBase = {
  ownerId: "u1",
  rarity: "common" as const,
  foundAtTurn: 1,
  foundDuringAction: "explore",
  used: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const offenseArtifact: GameArtifact = {
  ...artifactBase,
  id: "off-art-1",
  definitionId: "offense-boost",
  type: "offense",
};

const intelArtifact: GameArtifact = {
  ...artifactBase,
  id: "intel-art-1",
  definitionId: "intel-scout",
  type: "intel",
};

const defenseArtifact: GameArtifact = {
  ...artifactBase,
  id: "def-art-1",
  definitionId: "defense-wall",
  type: "defense",
};

function makeRowProps(overrides: Partial<React.ComponentProps<typeof ThreatRow>> = {}) {
  return {
    entry,
    player: {
      ...BASE_PLAYER,
      userId: "u1",
      caste: "red" as const,
      phase: "play" as const,
      turnsRemaining: 50,
      stats: { ...BASE_PLAYER.stats, tilesHeld: 10 },
    },
    artifacts: [offenseArtifact, intelArtifact, defenseArtifact],
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
    ...overrides,
  };
}

describe("ThreatRow", () => {
  it("renders enemy display name when collapsed", () => {
    render(<ThreatRow {...makeRowProps()} />);
    expect(screen.getByText(/Rival/i)).toBeInTheDocument();
  });

  it("expands and runs attack with units, spell, and queued artifact", async () => {
    const user = userEvent.setup();
    const onAttack = jest.fn().mockResolvedValue({
      outcome: "captured",
      reportSummary: "Captured tile",
      intelReport: null,
      combat: null,
      report: null,
      targetTile: null,
    });
    const onUseArtifact = jest.fn().mockResolvedValue({ intelReport: null });

    render(
      <ThreatRow
        {...makeRowProps({ onAttack, onUseArtifact, defaultExpanded: true })}
      />,
    );

    const groundInput = screen.getByLabelText(/^G\//i);
    await user.clear(groundInput);
    await user.type(groundInput, "3");

    await user.click(screen.getByRole("button", { name: /pick offense spell/i }));
    await user.click(screen.getByRole("button", { name: /queue offense artifact/i }));

    const attackBtn = screen.getByRole("button", { name: /ATTACK/i });
    await waitFor(() => expect(attackBtn).not.toBeDisabled());
    await user.click(attackBtn);

    await waitFor(() => {
      expect(onUseArtifact).toHaveBeenCalledWith("off-art-1", "1_0");
      expect(onAttack).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceTileId: "0_0",
          targetTileId: "1_0",
          units: { ground: 3, siege: 0, air: 0 },
          offenseSpellId: "red-offense-inferno",
        }),
      );
    });
    expect(screen.getByText(/Captured tile/i)).toBeInTheDocument();
  });

  it("delegates full combat to onBattleResolved", async () => {
    const user = userEvent.setup();
    const combat = { outcome: "captured" };
    const report = { kind: "attack" };
    const targetTile = { ...enemyTile, ownerId: "u1" };
    const onBattleResolved = jest.fn();
    const onAttack = jest.fn().mockResolvedValue({
      outcome: "captured",
      reportSummary: "Win",
      intelReport: null,
      combat,
      report,
      targetTile,
    });

    render(
      <ThreatRow
        {...makeRowProps({ onAttack, onBattleResolved, defaultExpanded: true })}
      />,
    );

    const groundInput = screen.getByLabelText(/^G\//i);
    await user.clear(groundInput);
    await user.type(groundInput, "2");
    await user.click(screen.getByRole("button", { name: /ATTACK/i }));

    await waitFor(() => {
      expect(onBattleResolved).toHaveBeenCalledWith({ combat, report, targetTile });
    });
  });

  it("runs boost actions and defense panel handlers", async () => {
    const user = userEvent.setup();
    const intelReport = {
      targetTileId: "1_0",
      target: {
        landType: "military",
        units: { ground: 3, siege: 0, air: 0 },
        armedDefenseSpellId: null,
      },
    };
    const onCastIntelSpell = jest
      .fn()
      .mockResolvedValue({ intelReport, detected: true });
    const onSiege = jest.fn().mockResolvedValue({
      reportSummary: "Siege hit",
      siegeTotalMagnitude: 0.2,
    });
    const onRecruit = jest.fn().mockResolvedValue({ produced: 10, reportSummary: "+10 ground" });
    const onDistributeTile = jest.fn().mockResolvedValue({ reportSummary: "Set to food" });
    const onArmDefenseSpell = jest.fn().mockResolvedValue({ reportSummary: "Armed" });
    const onUseArtifact = jest.fn().mockResolvedValue({ intelReport: null });

    render(
      <ThreatRow
        {...makeRowProps({
          onCastIntelSpell,
          onSiege,
          onRecruit,
          onDistributeTile,
          onArmDefenseSpell,
          onUseArtifact,
          defaultExpanded: true,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /cast intel spell/i }));
    await user.click(screen.getByRole("button", { name: /^Siege$/i }));
    const recruitButtons = screen.getAllByRole("button", { name: /· 5t$/i });
    await user.click(recruitButtons[0]!);

    await user.click(screen.getByRole("tab", { name: /Defense/i }));
    await user.click(screen.getByRole("button", { name: /assign food/i }));
    await user.click(screen.getByRole("button", { name: /arm defense spell/i }));
    await user.click(screen.getByRole("button", { name: /use defense artifact/i }));

    await waitFor(() => {
      expect(onCastIntelSpell).toHaveBeenCalled();
      expect(onSiege).toHaveBeenCalled();
      expect(onRecruit).toHaveBeenCalled();
      expect(onDistributeTile).toHaveBeenCalledWith("0_0", "food");
      expect(onArmDefenseSpell).toHaveBeenCalled();
      expect(onUseArtifact).toHaveBeenCalledWith("def-art-1", "0_0");
    });
  });

  it("disables attack when enemy is shielded", () => {
    const shieldedEntry: ThreatEntry = {
      ...entry,
      enemyOwner: { ...entry.enemyOwner!, shielded: true },
    };
    render(
      <ThreatRow {...makeRowProps({ entry: shieldedEntry, defaultExpanded: true })} />,
    );
    expect(screen.getAllByText(/shielded/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /ATTACK/i })).toBeDisabled();
  });

  it("opens source picker modal and switches source tile", async () => {
    const user = userEvent.setup();
    render(<ThreatRow {...makeRowProps({ defaultExpanded: true })} />);
    await user.click(screen.getByRole("button", { name: /change source/i }));
    await user.click(screen.getByRole("button", { name: /pick alt source/i }));
    await user.click(screen.getByRole("button", { name: /close source modal/i }));
    expect(screen.queryByRole("button", { name: /pick alt source/i })).not.toBeInTheDocument();
  });
});
