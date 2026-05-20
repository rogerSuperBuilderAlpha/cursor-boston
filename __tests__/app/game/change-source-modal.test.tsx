/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/threats/_components/ChangeSourceModal.tsx`
 * (0% / 13 uncovered branches). Covers candidate list rendering, badge
 * branches (best, current, neither), unassigned vs typed-land tile,
 * units total display, click-to-select + onClose, backdrop click close,
 * X button close, Escape close, body click no-op (event stopPropagation).
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/app/game/_components/CatalogImage", () => ({
  CatalogImage: ({ entry }: { entry: { name?: string } }) => (
    <span data-testid="catalog-image">{entry?.name ?? "img"}</span>
  ),
}));

jest.mock("@/lib/game/content", () => ({
  buildingForCasteAndLand: (caste: string, type: string) =>
    type === "military" ? { name: `${caste}-barracks` } : null,
}));

import { ChangeSourceModal } from "@/app/game/threats/_components/ChangeSourceModal";

function makeTile(over: Partial<Record<string, unknown>> = {}) {
  return {
    tileId: "t1",
    type: "military",
    units: { ground: 5, siege: 2, air: 1 },
    ...over,
  } as never;
}

function renderModal(over: Partial<Record<string, unknown>> = {}) {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  const props = {
    candidates: [makeTile()],
    myCaste: "red",
    currentSourceId: "",
    bestSourceId: "",
    targetTileId: "enemy-1",
    onSelect,
    onClose,
    ...over,
  } as never;
  render(<ChangeSourceModal {...props} />);
  return { onSelect, onClose };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ChangeSourceModal", () => {
  it("renders header with candidate count and target tile id", () => {
    renderModal({
      candidates: [makeTile({ tileId: "t1" }), makeTile({ tileId: "t2" })],
      targetTileId: "enemy-99",
    });
    expect(screen.getByText(/2 of your tiles border/)).toBeInTheDocument();
    expect(screen.getByText("enemy-99")).toBeInTheDocument();
  });

  it("renders 'best' badge when tile is the best source", () => {
    renderModal({
      candidates: [makeTile({ tileId: "t1" })],
      bestSourceId: "t1",
    });
    expect(screen.getByText(/best/)).toBeInTheDocument();
  });

  it("renders 'current' badge when tile is current but not best", () => {
    renderModal({
      candidates: [makeTile({ tileId: "t1" })],
      currentSourceId: "t1",
      bestSourceId: "other",
    });
    expect(screen.getByText("current")).toBeInTheDocument();
  });

  it("does NOT render 'current' badge when tile is also best", () => {
    renderModal({
      candidates: [makeTile({ tileId: "t1" })],
      currentSourceId: "t1",
      bestSourceId: "t1",
    });
    expect(screen.queryByText("current")).not.toBeInTheDocument();
    expect(screen.getByText(/best/)).toBeInTheDocument();
  });

  it("renders units summary with total count when >0", () => {
    renderModal({
      candidates: [
        makeTile({
          tileId: "t1",
          units: { ground: 3, siege: 2, air: 1 },
        }),
      ],
    });
    expect(screen.getByText(/G3 · S2 · A1/)).toBeInTheDocument();
    expect(screen.getByText(/6 total/)).toBeInTheDocument();
  });

  it("does NOT render '(N total)' when units total is 0", () => {
    renderModal({
      candidates: [makeTile({ units: { ground: 0, siege: 0, air: 0 } })],
    });
    expect(screen.queryByText(/\(0 total\)/)).not.toBeInTheDocument();
  });

  it("renders the building name when tile is typed (not unassigned)", () => {
    renderModal({
      candidates: [makeTile({ type: "military" })],
      myCaste: "red",
    });
    expect(screen.getAllByText("red-barracks").length).toBeGreaterThan(0);
  });

  it("does NOT call buildingForCasteAndLand on unassigned tiles", () => {
    renderModal({
      candidates: [
        makeTile({
          tileId: "t1",
          type: "unassigned",
        }),
      ],
    });
    expect(screen.queryByText(/barracks/)).not.toBeInTheDocument();
  });

  it("clicking a tile invokes onSelect + onClose", () => {
    const { onSelect, onClose } = renderModal({
      candidates: [makeTile({ tileId: "t1" })],
    });
    fireEvent.click(screen.getByText("t1"));
    expect(onSelect).toHaveBeenCalledWith("t1");
    expect(onClose).toHaveBeenCalled();
  });

  it("backdrop click invokes onClose", () => {
    const { onClose } = renderModal();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });

  it("X close button invokes onClose", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape key invokes onClose", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking inside the modal body does NOT close (stopPropagation)", () => {
    const { onClose } = renderModal();
    const tileBtn = screen.getByText("t1").closest("button")!;
    // Click the inner container (not a tile button)
    const innerContainer = tileBtn.parentElement!;
    fireEvent.click(innerContainer);
    // onClose should NOT have been called from the body click (only fires via backdrop/X/Esc/select)
    expect(onClose).not.toHaveBeenCalled();
  });
});
