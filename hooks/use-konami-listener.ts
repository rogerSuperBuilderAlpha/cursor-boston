/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect } from "react";
import {
  nextSequenceIndex,
  type KonamiSequence,
} from "@/lib/konami-handler";

export function useKonamiListener(
  sequence: KonamiSequence,
  onComplete: () => void
) {
  useEffect(() => {
    let index = 0;

    function onKey(event: KeyboardEvent) {
      index = nextSequenceIndex(sequence, index, event.key);
      if (index === sequence.length) {
        index = 0;
        onComplete();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onComplete, sequence]);
}
