/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { CASTE_COLOR_HEX, CASTE_LABEL } from "./world-constants";

interface HowToPlayDrawerProps {
  open: boolean;
  onClose: () => void;
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

export function HowToPlayDrawer({ open, onClose }: HowToPlayDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity z-20 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className={`absolute top-0 left-0 h-full w-[min(380px,calc(100vw-3rem))] bg-neutral-900/95 backdrop-blur border-r border-neutral-700/60 transform transition-transform duration-300 z-30 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="font-semibold">How to read this map</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="text-neutral-400 hover:text-neutral-100 px-2 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto h-[calc(100%-3.5rem)]">
          <section>
            <h3 className="text-xs uppercase tracking-wide text-neutral-400 mb-2">
              Tile types
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-3">
                <span className="inline-block w-3 h-5 rounded-sm bg-amber-700" />
                <span>
                  <strong>Barracks</strong> — military tile, recruits units
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-block w-4 h-4 rounded-full bg-green-600" />
                <span>
                  <strong>Farm / Silo</strong> — food tile, feeds armies
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-block w-3 h-5 rounded-t-full bg-purple-500" />
                <span>
                  <strong>Spire</strong> — magic tile, fuels spells
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wide text-neutral-400 mb-2">
              Castes
            </h3>
            <ul className="grid grid-cols-2 gap-y-2 text-sm">
              {(
                Object.keys(CASTE_COLOR_HEX) as Array<
                  keyof typeof CASTE_COLOR_HEX
                >
              ).map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3.5 h-3.5 rounded-sm border border-neutral-700"
                    style={{ backgroundColor: hexToCss(CASTE_COLOR_HEX[c]) }}
                  />
                  <span>{CASTE_LABEL[c]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wide text-neutral-400 mb-2">
              Markers
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <strong>Banner</strong> — a hero is stationed on this tile.
              </li>
              <li>
                <strong>Skull pennant</strong> — held by an NPC. Conquer it for
                land + glory.
              </li>
              <li>
                <strong>Glow</strong> — the tile has recruited units beyond its
                base garrison. Heavier defense ahead.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wide text-neutral-400 mb-2">
              How turns work
            </h3>
            <p className="text-sm text-neutral-300">
              Merge a PR into the cursor-boston repo any time during a week and
              you&apos;ll receive 100 turns the following Sunday at midnight
              EST. No PR, no turns.
            </p>
          </section>

          <section className="pt-2">
            <Link
              href="/game/help"
              className="inline-block text-sm text-emerald-400 hover:text-emerald-300"
            >
              Full game rules →
            </Link>
          </section>
        </div>
      </aside>
    </>
  );
}
