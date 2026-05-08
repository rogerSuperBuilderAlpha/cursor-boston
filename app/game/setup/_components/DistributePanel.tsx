/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { Caste, LandType, MapTile } from "@/lib/game/types";
import { CASTES, DISTRIBUTABLE } from "../_lib/constants";
import { CastePickCard } from "./CastePickCard";

interface Props {
  tiles: MapTile[];
  busy: boolean;
  onDistribute: (tileId: string, type: LandType) => void;
  onChooseCaste: (caste: Caste) => void;
}

/**
 * Distribute-phase UI: type counters at the top, caste-pick cards in
 * the middle, and a per-tile assignment grid at the bottom. Tiles are
 * the source of truth — each row gets M / F / G buttons that flip the
 * tile's type via the parent's `onDistribute`.
 */
export function DistributePanel({
  tiles,
  busy,
  onDistribute,
  onChooseCaste,
}: Props) {
  const distributable = tiles.filter((t) => t.type !== "unrevealed");
  const counts = {
    military: distributable.filter((t) => t.type === "military").length,
    food: distributable.filter((t) => t.type === "food").length,
    magic: distributable.filter((t) => t.type === "magic").length,
    unassigned: distributable.filter((t) => t.type === "unassigned").length,
  };

  return (
    <div>
      <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4 text-sm leading-relaxed space-y-2">
        <p className="font-semibold">Step 2 of 3 — Distribute</p>
        <p>
          Assign each tile a role. Each change (including re-changes) costs 1
          turn:
        </p>
        <ul className="list-disc ml-5">
          <li>
            <strong>Military (M)</strong> — the only tiles that can produce
            units. More military = faster army-building.
          </li>
          <li>
            <strong>Food (F)</strong> — raises your <em>total</em> unit cap.
            Soft-capped: each food tile is +5 cap up to 50 tiles, then +2.5
            each.
          </li>
          <li>
            <strong>Magic (G)</strong> — multiplies your spell strength when
            you cast. Same soft-cap shape.
          </li>
        </ul>
        <p className="text-neutral-600 dark:text-neutral-400">
          A balanced empire usually wants ~30 military, ~30 food, ~30 magic.
          But specialize if you want — heavy military rushes early, heavy magic
          dominates spell-heavy castes.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6 text-center text-sm">
        <Counter label="Military" value={counts.military} />
        <Counter label="Food" value={counts.food} />
        <Counter label="Magic" value={counts.magic} />
        <Counter label="Unassigned" value={counts.unassigned} />
      </div>

      <div className="mb-6">
        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4 text-sm leading-relaxed space-y-2">
          <p className="font-semibold">Step 3 of 3 — Pick a caste (permanent)</p>
          <p>
            Each card shows the lore, the three units you&apos;ll recruit, the
            three spells you&apos;ll cast, and the building upgrades available.
            The choice is locked the moment you pick.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {CASTES.map((c) => (
            <CastePickCard
              key={c}
              caste={c}
              busy={busy}
              onChoose={() => onChooseCaste(c)}
            />
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          You can keep redistributing tiles after picking a caste — but caste
          itself is locked permanently.
        </p>
      </div>

      <h2 className="font-semibold mb-3">
        Tiles ({distributable.length})
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
        {distributable.map((t) => (
          <div
            key={t.tileId}
            className="flex items-center justify-between border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm"
          >
            <div>
              <span className="font-mono">{t.tileId}</span>
              <span className="ml-2 capitalize text-neutral-500">{t.type}</span>
            </div>
            <div className="flex gap-1">
              {DISTRIBUTABLE.map((type) => (
                <button
                  key={type}
                  onClick={() => onDistribute(t.tileId, type)}
                  disabled={busy || t.type === type}
                  className={`px-2 py-1 rounded text-xs border ${
                    t.type === type
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  } disabled:opacity-50`}
                >
                  {type[0].toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
