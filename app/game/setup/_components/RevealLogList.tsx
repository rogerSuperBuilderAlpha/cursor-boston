/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { RARITY_COLORS } from "../_lib/constants";
import type { RevealLog } from "../_lib/types";

export function RevealLogList({ reveals }: { reveals: RevealLog[] }) {
  if (reveals.length === 0) {
    return (
      <p className="text-xs text-neutral-500 italic mt-4">
        Field reports will appear here once you start exploring. Each spent
        turn yields a brief narrative — and, with luck, an ancient artifact.
      </p>
    );
  }
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2">
        Field reports (newest first)
      </h3>
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg max-h-96 overflow-y-auto">
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {reveals.map((r, idx) => (
            <li
              key={`${r.tileId}-${r.at}-${idx}`}
              className="px-4 py-3 text-sm leading-relaxed"
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-medium">
                  {r.summary ?? `Revealed ${r.tileId}`}
                </span>
                <span className="text-xs text-neutral-500 capitalize ml-2 shrink-0">
                  {r.type}
                </span>
              </div>
              {r.narrative && r.narrative.length > 0 && (
                <div className="text-neutral-600 dark:text-neutral-400 italic space-y-1">
                  {r.narrative.map((line, lineIdx) => (
                    <p key={lineIdx}>{line}</p>
                  ))}
                </div>
              )}
              {r.artifactFound && (
                <div
                  className={`mt-2 text-xs font-semibold uppercase tracking-wide ${
                    RARITY_COLORS[r.artifactFound.rarity] ?? ""
                  }`}
                >
                  {r.artifactFound.rarity} artifact found —{" "}
                  <span className="normal-case">{r.artifactFound.name}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-neutral-500 mt-2">
        Showing the last {reveals.length} report
        {reveals.length === 1 ? "" : "s"} from this session.{" "}
        <Link href="/game/artifacts" className="underline hover:no-underline">
          View artifact inventory →
        </Link>
      </p>
    </div>
  );
}
