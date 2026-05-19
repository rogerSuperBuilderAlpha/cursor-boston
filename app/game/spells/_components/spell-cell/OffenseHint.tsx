/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";

export function OffenseHint() {
  return (
    <p className="text-[11px] text-neutral-500 italic leading-relaxed">
      Attached at attack time. Open an enemy tile from{" "}
      <Link href="/game/tiles" className="underline hover:no-underline">
        Manage tiles
      </Link>{" "}
      and pick this spell in the attack panel.
    </p>
  );
}
