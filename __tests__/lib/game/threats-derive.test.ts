/**
 * @jest-environment node
 */
import { deriveThreatEntries } from "@/app/game/threats/_lib/threats-derive";
import type { MapTile } from "@/lib/game/types";
import type { OwnerSummary } from "@/app/game/_lib/dashboard-types";

const myTile: MapTile = {
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
  units: { ground: 2, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

const owners = new Map<string, OwnerSummary>([
  [
    "u2",
    {
      userId: "u2",
      displayName: "Rival",
      caste: "blue",
      shielded: false,
      isNpc: false,
    },
  ],
]);

describe("deriveThreatEntries", () => {
  it("returns empty when no world tiles", () => {
    expect(
      deriveThreatEntries({
        myUserId: "u1",
        myCaste: "red",
        myTiles: [myTile],
        worldTiles: [],
        worldOwners: owners,
      }),
    ).toEqual([]);
  });

  it("groups adjacent enemy tiles with advantage score", () => {
    const entries = deriveThreatEntries({
      myUserId: "u1",
      myCaste: "red",
      myTiles: [myTile],
      worldTiles: [myTile, enemyTile],
      worldOwners: owners,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].enemyTile.tileId).toBe("1_0");
    expect(entries[0].bestSource.tileId).toBe("0_0");
    expect(entries[0].myAdvantage).toBeGreaterThan(1);
    expect(entries[0].enemyOwner?.displayName).toBe("Rival");
  });
});
