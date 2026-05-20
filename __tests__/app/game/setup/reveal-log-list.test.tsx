/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/setup/_components/RevealLogList.tsx`
 * was at 9.1% branches. Covers empty state, list rendering, summary
 * fallback, narrative paragraph rendering, missing-narrative skip,
 * artifact-found block + known/unknown rarity color path, plural vs
 * singular "report(s)" footer copy.
 */

import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { RevealLogList } from "@/app/game/setup/_components/RevealLogList";
import type { RevealLog } from "@/app/game/setup/_lib/types";

function makeReveal(over: Partial<RevealLog> = {}): RevealLog {
  return {
    tileId: "0_0",
    type: "military",
    at: Date.now(),
    ...over,
  };
}

describe("RevealLogList", () => {
  it("renders the empty-state copy when reveals is empty", () => {
    render(<RevealLogList reveals={[]} />);
    expect(
      screen.getByText(/Field reports will appear here once you start exploring/)
    ).toBeInTheDocument();
    // No heading or report list.
    expect(screen.queryByText(/Field reports \(newest first\)/)).toBeNull();
  });

  it("renders heading + one report when given one reveal", () => {
    render(
      <RevealLogList
        reveals={[makeReveal({ summary: "Found a temple", type: "magic" })]}
      />
    );
    expect(screen.getByText("Field reports (newest first)")).toBeInTheDocument();
    expect(screen.getByText("Found a temple")).toBeInTheDocument();
    expect(screen.getByText("magic")).toBeInTheDocument();
  });

  it("falls back to 'Revealed <tileId>' when summary is missing", () => {
    render(<RevealLogList reveals={[makeReveal({ tileId: "5_3" })]} />);
    expect(screen.getByText("Revealed 5_3")).toBeInTheDocument();
  });

  it("renders each narrative line as a separate paragraph", () => {
    render(
      <RevealLogList
        reveals={[
          makeReveal({
            summary: "Story",
            narrative: ["Line one.", "Line two.", "Line three."],
          }),
        ]}
      />
    );
    expect(screen.getByText("Line one.")).toBeInTheDocument();
    expect(screen.getByText("Line two.")).toBeInTheDocument();
    expect(screen.getByText("Line three.")).toBeInTheDocument();
  });

  it("does NOT render a narrative wrapper when narrative is undefined", () => {
    const { container } = render(
      <RevealLogList reveals={[makeReveal({ summary: "x" })]} />
    );
    // No <p> inside an italic div for narrative when missing.
    expect(container.querySelector(".italic")).toBeNull();
  });

  it("does NOT render a narrative wrapper when narrative is an empty array", () => {
    const { container } = render(
      <RevealLogList reveals={[makeReveal({ summary: "x", narrative: [] })]} />
    );
    expect(container.querySelector(".italic")).toBeNull();
  });

  it("renders the artifact-found block with the rarity name + artifact name", () => {
    render(
      <RevealLogList
        reveals={[
          makeReveal({
            summary: "Dig",
            artifactFound: {
              definitionId: "ring-of-fire",
              name: "Ring of Fire",
              rarity: "legendary",
              type: "offense",
            },
          }),
        ]}
      />
    );
    expect(screen.getByText(/legendary artifact found/)).toBeInTheDocument();
    expect(screen.getByText("Ring of Fire")).toBeInTheDocument();
  });

  it("applies the known rarity color class on the artifact line", () => {
    const { container } = render(
      <RevealLogList
        reveals={[
          makeReveal({
            artifactFound: {
              definitionId: "x",
              name: "Glove",
              rarity: "rare",
              type: "defense",
            },
          }),
        ]}
      />
    );
    // "rare" maps to "text-blue-600 dark:text-blue-400"
    const artifactLine = container.querySelector(".text-blue-600");
    expect(artifactLine).not.toBeNull();
    expect(artifactLine!.textContent).toMatch(/rare artifact found/);
  });

  it("uses the empty-string fallback when rarity has no entry in RARITY_COLORS", () => {
    // Pass an unknown rarity through `as never` to hit the `?? ""` branch.
    const reveals = [
      makeReveal({
        artifactFound: {
          definitionId: "x",
          name: "Mystery",
          rarity: "mythic" as never,
          type: "utility",
        },
      }),
    ];
    const { container } = render(<RevealLogList reveals={reveals} />);
    // The artifact line is rendered but does not pick up any of the known
    // RARITY_COLORS classes.
    const artifactLines = container.querySelectorAll(".mt-2.text-xs");
    expect(artifactLines.length).toBeGreaterThan(0);
    expect(
      Array.from(artifactLines).some((el) => /mythic artifact found/i.test(el.textContent ?? ""))
    ).toBe(true);
  });

  it("does NOT render an artifact block when artifactFound is undefined", () => {
    const { container } = render(
      <RevealLogList reveals={[makeReveal({ summary: "x" })]} />
    );
    expect(container.querySelector(".uppercase.tracking-wide")).toBeNull();
  });

  it("renders singular 'report' copy when reveals.length === 1", () => {
    render(<RevealLogList reveals={[makeReveal({ summary: "x" })]} />);
    expect(screen.getByText(/Showing the last 1 report/)).toBeInTheDocument();
    // No trailing 's'.
    expect(screen.queryByText(/Showing the last 1 reports/)).toBeNull();
  });

  it("renders plural 'reports' copy when reveals.length > 1", () => {
    render(
      <RevealLogList
        reveals={[
          makeReveal({ summary: "a", tileId: "0_0" }),
          makeReveal({ summary: "b", tileId: "0_1" }),
        ]}
      />
    );
    expect(screen.getByText(/Showing the last 2 reports/)).toBeInTheDocument();
  });

  it("includes the artifact-inventory link", () => {
    render(<RevealLogList reveals={[makeReveal({ summary: "x" })]} />);
    const link = screen
      .getByText(/View artifact inventory/)
      .closest("a");
    expect(link).toHaveAttribute("href", "/game/artifacts");
  });
});
