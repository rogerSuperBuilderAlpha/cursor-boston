/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useMemo, useState } from "react";
import { CatalogImage } from "@/app/game/_components/CatalogImage";
import {
  ALL_BUILDINGS,
  ALL_UNITS,
  UPGRADES_BY_ID,
} from "@/lib/game/content";
import { getActiveUpgrades } from "@/lib/game/upgrades";
import type {
  BuildingDefinition,
  Caste,
  GamePlayer,
  UnitDefinition,
  UpgradeDefinition,
} from "@/lib/game/types";

export interface ArmyPanelProps {
  player: GamePlayer;
}

interface UnitRow {
  unit: UnitDefinition;
  upgrade: UpgradeDefinition | null;
}
interface BuildingRow {
  building: BuildingDefinition;
  upgrade: UpgradeDefinition | null;
}

/**
 * Top-of-page reference card on the Threats list. Shows the player's
 * caste, their three unit profiles (ground / siege / air) with whichever
 * caste-specific upgrade is active on each, and the three caste buildings
 * (military / food / magic) with the same. Lets the player see at a
 * glance what their army's actually carrying before they commit to a
 * matchup — no need to round-trip to /game/upgrades.
 *
 * Units and buildings whose upgrade slot is empty render with a dimmed
 * "no upgrade picked" badge linking the player to /game/upgrades.
 */
export function ArmyPanel(props: ArmyPanelProps) {
  const { player } = props;
  const [open, setOpen] = useState(true);

  const rows = useMemo(() => {
    if (!player.caste) {
      return { units: [], buildings: [] };
    }
    return computeRows(player.caste, getActiveUpgrades(player));
  }, [player]);

  if (!player.caste) return null;

  return (
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-baseline justify-between text-left hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
        aria-expanded={open}
      >
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-700 dark:text-neutral-200">
            🪖 Your army
          </h2>
          <span className="text-[10px] text-neutral-500 capitalize">
            · {player.caste} caste
          </span>
        </div>
        <span className="text-xs text-neutral-500">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3">
          <Group label="Units" rows={rows.units} kind="unit" />
          <Group
            label="Tiles & buildings"
            rows={rows.buildings}
            kind="building"
          />
        </div>
      )}
    </section>
  );
}

function Group({
  label,
  rows,
  kind,
}: {
  label: string;
  rows: ReadonlyArray<UnitRow | BuildingRow>;
  kind: "unit" | "building";
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h3 className="text-[11px] uppercase tracking-wide text-neutral-500">
        {label}
      </h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <Card key={kind === "unit" ? (row as UnitRow).unit.id : (row as BuildingRow).building.id} row={row} kind={kind} />
        ))}
      </div>
    </div>
  );
}

function Card({
  row,
  kind,
}: {
  row: UnitRow | BuildingRow;
  kind: "unit" | "building";
}) {
  const base = kind === "unit" ? (row as UnitRow).unit : (row as BuildingRow).building;
  const upgrade = row.upgrade;
  const subtitle =
    kind === "unit"
      ? `${(row as UnitRow).unit.type}`
      : `${(row as BuildingRow).building.landType}`;
  // When an upgrade is picked, show its art + name; otherwise show the
  // base unit/building art so the row still has a visual.
  const display = upgrade ?? base;
  const tone = upgrade
    ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/10"
    : "border-neutral-200 dark:border-neutral-800";
  return (
    <div
      className={`flex items-start gap-2 p-2 rounded-md border ${tone}`}
      title={upgrade?.description ?? base.description}
    >
      <CatalogImage entry={display} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium truncate">{base.name}</span>
          <span className="text-[10px] uppercase tracking-wide text-neutral-500 shrink-0">
            {subtitle}
          </span>
        </div>
        {upgrade ? (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5 truncate">
            ⚙ {upgrade.name}
          </p>
        ) : (
          <p className="text-[11px] text-neutral-500 italic mt-0.5">
            no upgrade picked
          </p>
        )}
      </div>
    </div>
  );
}

function computeRows(
  caste: Caste,
  active: Record<string, string>
): { units: UnitRow[]; buildings: BuildingRow[] } {
  const units: UnitRow[] = ALL_UNITS.filter((u) => u.caste === caste)
    .sort(unitSort)
    .map((u) => ({
      unit: u,
      upgrade: lookupUpgrade(active[u.id]),
    }));
  const buildings: BuildingRow[] = ALL_BUILDINGS.filter((b) => b.caste === caste)
    .sort(buildingSort)
    .map((b) => ({
      building: b,
      upgrade: lookupUpgrade(active[b.id]),
    }));
  return { units, buildings };
}

function lookupUpgrade(upgradeId: string | undefined): UpgradeDefinition | null {
  if (!upgradeId) return null;
  return UPGRADES_BY_ID.get(upgradeId) ?? null;
}

function unitSort(a: UnitDefinition, b: UnitDefinition): number {
  const order = { ground: 0, siege: 1, air: 2 } as const;
  return order[a.type] - order[b.type];
}

function buildingSort(a: BuildingDefinition, b: BuildingDefinition): number {
  const order: Record<string, number> = { military: 0, food: 1, magic: 2 };
  return (order[a.landType] ?? 99) - (order[b.landType] ?? 99);
}
