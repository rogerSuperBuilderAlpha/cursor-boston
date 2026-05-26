/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export type KonamiSequence = readonly string[];

export const KONAMI_SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const satisfies KonamiSequence;

const SEQUENCE_PROOF_KEYS: Record<string, string> = {
  ArrowUp: "U",
  ArrowDown: "D",
  ArrowLeft: "L",
  ArrowRight: "R",
  b: "B",
  a: "A",
};

/** @internal */
export function sequenceToHeaderProof(sequence: KonamiSequence): string {
  return sequence
    .map((key) => SEQUENCE_PROOF_KEYS[key] ?? key.slice(0, 1).toUpperCase())
    .join("");
}

export const KONAMI_SEQUENCE_HEADER = sequenceToHeaderProof(KONAMI_SEQUENCE);

/** @internal */
export function keyMatchesSequenceValue(key: string, expected: string): boolean {
  return key.toLowerCase() === expected.toLowerCase();
}

export function nextSequenceIndex(
  sequence: KonamiSequence,
  currentIndex: number,
  key: string
): number {
  const expected = sequence[currentIndex];
  if (expected && keyMatchesSequenceValue(key, expected)) {
    return currentIndex + 1;
  }

  const first = sequence[0];
  return first && keyMatchesSequenceValue(key, first) ? 1 : 0;
}
