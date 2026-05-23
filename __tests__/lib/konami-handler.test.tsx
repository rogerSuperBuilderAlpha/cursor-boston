/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 */

import { useCallback, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  KONAMI_SEQUENCE,
  KONAMI_SEQUENCE_HEADER,
  nextSequenceIndex,
  sequenceToHeaderProof,
  type KonamiSequence,
} from "@/lib/konami-handler";
import { useKonamiListener } from "@/hooks/use-konami-listener";

function CustomSequenceProbe({ sequence }: { sequence: KonamiSequence }) {
  const [completions, setCompletions] = useState(0);
  const onComplete = useCallback(() => {
    setCompletions((value) => value + 1);
  }, []);

  useKonamiListener(sequence, onComplete);

  return <output aria-label="Completions">{completions}</output>;
}

function pressKeys(sequence: KonamiSequence) {
  for (const key of sequence) {
    fireEvent.keyDown(window, { key });
  }
}

describe("konami handler", () => {
  it("serializes the current sequence proof for the oracle header", () => {
    expect(sequenceToHeaderProof(KONAMI_SEQUENCE)).toBe("UUDDLRLRBA");
    expect(KONAMI_SEQUENCE_HEADER).toBe("UUDDLRLRBA");
  });

  it("advances and resets progress for partial key sequences", () => {
    let index = nextSequenceIndex(KONAMI_SEQUENCE, 0, "ArrowUp");
    expect(index).toBe(1);

    index = nextSequenceIndex(KONAMI_SEQUENCE, index, "ArrowUp");
    expect(index).toBe(2);

    index = nextSequenceIndex(KONAMI_SEQUENCE, index, "Escape");
    expect(index).toBe(0);
  });

  it("restarts progress when the wrong key is also the sequence prefix", () => {
    const sequence = ["a", "b", "a"] as const;
    let index = nextSequenceIndex(sequence, 0, "a");
    index = nextSequenceIndex(sequence, index, "a");

    expect(index).toBe(1);
  });

  it("calls onComplete for a custom sequence", () => {
    render(<CustomSequenceProbe sequence={["x", "y", "z"]} />);

    pressKeys(["x", "y", "z"]);

    expect(screen.getByLabelText("Completions")).toHaveTextContent("1");
  });

  it("does not complete on an incomplete custom sequence", () => {
    render(<CustomSequenceProbe sequence={["q", "w"]} />);

    pressKeys(["q"]);

    expect(screen.getByLabelText("Completions")).toHaveTextContent("0");
  });
});
