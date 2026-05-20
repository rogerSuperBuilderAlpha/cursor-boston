/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/_components/dashboard/ThreatCard.tsx`
 * (30.8% / 9 uncovered branches). Three render branches:
 *   - shielded (with plural / singular foreign-neighbor copy + zero-neighbor
 *     case that suppresses the bordering-generals tail)
 *   - empty (no unshielded + no foreign at all)
 *   - alert (unshielded > 0, with names truncated, shielded-difference tail,
 *     and the "View all threats →" link)
 */

import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    require("react").createElement("a", { href }, children),
}));

import { ThreatCard } from "@/app/game/_components/dashboard/ThreatCard";

function threats(over: Partial<Record<string, unknown>> = {}) {
  return {
    unshieldedNeighbors: 0,
    totalForeignNeighbors: 0,
    topNeighborNames: [],
    ...over,
  } as never;
}

describe("ThreatCard — shielded variant", () => {
  it("renders the shielded copy when shielded=true and no foreign neighbors", () => {
    render(<ThreatCard threats={threats()} shielded={true} />);
    expect(screen.getByText("Shielded")).toBeInTheDocument();
    expect(screen.getByText(/No one can attack you yet\./)).toBeInTheDocument();
    expect(screen.queryByText(/You border/)).not.toBeInTheDocument();
  });

  it("appends plural border copy when shielded with > 1 foreign neighbors", () => {
    render(
      <ThreatCard
        threats={threats({ totalForeignNeighbors: 3 })}
        shielded={true}
      />
    );
    expect(screen.getByText(/You border 3 other generals\./)).toBeInTheDocument();
  });

  it("appends singular border copy when shielded with exactly 1 foreign neighbor", () => {
    render(
      <ThreatCard
        threats={threats({ totalForeignNeighbors: 1 })}
        shielded={true}
      />
    );
    expect(screen.getByText(/You border 1 other general\./)).toBeInTheDocument();
  });

  it("does NOT render the threats link in the shielded variant", () => {
    render(
      <ThreatCard
        threats={threats({ totalForeignNeighbors: 2 })}
        shielded={true}
      />
    );
    expect(screen.queryByRole("link", { name: /View all threats/ })).not.toBeInTheDocument();
  });
});

describe("ThreatCard — empty variant", () => {
  it("renders 'No bordering generals' when unshielded=0 and totalForeign=0", () => {
    render(<ThreatCard threats={threats()} shielded={false} />);
    expect(screen.getByText("No bordering generals")).toBeInTheDocument();
    expect(screen.getByText(/Push the frontier outward/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View all threats/ })).not.toBeInTheDocument();
  });
});

describe("ThreatCard — alert variant", () => {
  it("renders unshielded count and neighbor names when unshielded > 0", () => {
    render(
      <ThreatCard
        threats={threats({
          unshieldedNeighbors: 2,
          totalForeignNeighbors: 2,
          topNeighborNames: ["Ada", "Bob"],
        })}
        shielded={false}
      />
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/unshielded neighbors in range/)).toBeInTheDocument();
    expect(screen.getByText("Ada · Bob")).toBeInTheDocument();
  });

  it("renders without names when topNeighborNames is empty", () => {
    render(
      <ThreatCard
        threats={threats({
          unshieldedNeighbors: 1,
          totalForeignNeighbors: 1,
          topNeighborNames: [],
        })}
        shielded={false}
      />
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    // No bullet-joined names line
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it("renders the '+N shielded' tail when totalForeign > unshielded", () => {
    render(
      <ThreatCard
        threats={threats({
          unshieldedNeighbors: 2,
          totalForeignNeighbors: 5,
          topNeighborNames: ["Ada"],
        })}
        shielded={false}
      />
    );
    expect(screen.getByText(/\+ 3 shielded/)).toBeInTheDocument();
  });

  it("hides the '+N shielded' tail when totalForeign === unshielded", () => {
    render(
      <ThreatCard
        threats={threats({
          unshieldedNeighbors: 3,
          totalForeignNeighbors: 3,
          topNeighborNames: ["Ada", "Bob", "Cal"],
        })}
        shielded={false}
      />
    );
    // The "+ N shielded" tail is absent; the in-range line still includes
    // the word "unshielded" so we can't use a /shielded/ regex.
    expect(screen.queryByText(/\+ \d+ shielded/)).not.toBeInTheDocument();
  });

  it("renders the 'View all threats →' link pointing to /game/threats", () => {
    render(
      <ThreatCard
        threats={threats({
          unshieldedNeighbors: 1,
          totalForeignNeighbors: 1,
          topNeighborNames: ["Ada"],
        })}
        shielded={false}
      />
    );
    const link = screen.getByRole("link", { name: /View all threats/ });
    expect(link).toHaveAttribute("href", "/game/threats");
  });

  it("alert (unshielded > 0) → red-tinted border classes", () => {
    const { container } = render(
      <ThreatCard
        threats={threats({
          unshieldedNeighbors: 2,
          totalForeignNeighbors: 2,
          topNeighborNames: [],
        })}
        shielded={false}
      />
    );
    expect(container.querySelector(".border-red-200")).toBeTruthy();
  });

  it("renders the alert card path when only shielded foreign neighbors exist (unshielded=0, totalForeign>0)", () => {
    // unshieldedNeighbors === 0 but totalForeignNeighbors > 0 → falls through
    // the empty-variant guard and renders the alert card (with the neutral
    // border, not red) showing the "0 unshielded" count + "+N shielded" tail.
    const { container } = render(
      <ThreatCard
        threats={threats({
          unshieldedNeighbors: 0,
          totalForeignNeighbors: 4,
          topNeighborNames: [],
        })}
        shielded={false}
      />
    );
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText(/\+ 4 shielded/)).toBeInTheDocument();
    // Not red-tinted because unshielded is 0
    expect(container.querySelector(".border-red-200")).toBeFalsy();
  });
});
