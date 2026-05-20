/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/_components/dashboard/BulkUnassign.tsx`
 * (46.7% branch, 8 uncovered). Mirrors bulk-distribute.test.tsx: covers
 * the safeCount clamp, type-select state, busy label, disabled-when-max=0,
 * progress bar render, singular vs plural artifact copy, and the
 * non-numeric-input guard.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { BulkUnassign } from "@/app/game/_components/dashboard/BulkUnassign";
import type { MapTile } from "@/lib/game/types";

function tile(type: MapTile["type"], id = `t-${Math.random()}`): MapTile {
  return {
    id,
    type,
    revealed: true,
    ownerId: "u1",
  } as unknown as MapTile;
}

function renderPanel(over: Partial<Record<string, unknown>> = {}) {
  const onRun = jest.fn();
  const props = {
    tiles: [
      tile("military"),
      tile("military"),
      tile("military"),
      tile("food"),
      tile("magic"),
    ],
    turnsRemaining: 100,
    busy: false,
    progress: null,
    onRun,
    ...over,
  } as never;
  render(<BulkUnassign {...props} />);
  return { onRun };
}

describe("BulkUnassign", () => {
  it("renders default state with the source-type cap copy", () => {
    renderPanel();
    // 3 military tiles, default sourceType=military, default count=5,
    // turnsRemaining=100 → max=3, safeCount=3.
    expect(
      screen.getByRole("button", { name: /Revert 3 military → unassigned/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/3 military tiles/)).toBeInTheDocument();
    expect(screen.getByText(/cap 3/)).toBeInTheDocument();
  });

  it("renders singular 'tile' (not 'tiles') when sourceCount === 1", () => {
    renderPanel({ tiles: [tile("military")] });
    expect(screen.getByText(/1 military tile\b/)).toBeInTheDocument();
  });

  it("switching Source type updates the source-count and button label", () => {
    renderPanel();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "food" } });
    // Only 1 food tile → max=1, button text becomes "Revert 1 food".
    expect(
      screen.getByRole("button", { name: /Revert 1 food → unassigned/ }),
    ).toBeInTheDocument();
  });

  it("Count input accepts numeric input and clamps safeCount to max", () => {
    renderPanel({ turnsRemaining: 100 });
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "50" } });
    // 3 military × max → safeCount stays at 3.
    expect(
      screen.getByRole("button", { name: /Revert 3 military → unassigned/ }),
    ).toBeInTheDocument();
  });

  it("Count input ignores non-numeric input (Number.isFinite guard)", () => {
    renderPanel({ turnsRemaining: 100 });
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    // Count remained 5 → safeCount = min(5, 3) = 3.
    expect(
      screen.getByRole("button", { name: /Revert 3 military → unassigned/ }),
    ).toBeInTheDocument();
  });

  it("Run button invokes onRun with current sourceType + safeCount", () => {
    const { onRun } = renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: /Revert 3 military → unassigned/ }),
    );
    expect(onRun).toHaveBeenCalledWith("military", 3);
  });

  it("Run button is disabled when no tiles match the source type", () => {
    renderPanel({ tiles: [tile("food")] });
    // 0 military tiles → max=0 → button disabled, safeCount snaps to 1.
    expect(
      screen.getByRole("button", { name: /Revert 1 military → unassigned/ }),
    ).toBeDisabled();
  });

  it("safeCount caps at turnsRemaining when lower than sourceCount", () => {
    renderPanel({
      tiles: [tile("military"), tile("military"), tile("military"), tile("military")],
      turnsRemaining: 2,
    });
    expect(
      screen.getByRole("button", { name: /Revert 2 military → unassigned/ }),
    ).toBeInTheDocument();
  });

  it("renders busy label when busy=true and disables interactive controls", () => {
    renderPanel({ busy: true });
    expect(
      screen.getByRole("button", { name: /Reverting 3 tiles/ }),
    ).toBeDisabled();
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("spinbutton")).toBeDisabled();
  });

  it("renders progress bar + plural artifact copy when progress provided", () => {
    renderPanel({ progress: { done: 4, total: 10, artifactsFound: 2 } });
    expect(screen.getByText("4 / 10 tiles reverted")).toBeInTheDocument();
    expect(screen.getByText("2 artifacts found")).toBeInTheDocument();
  });

  it("uses singular 'artifact' when artifactsFound === 1", () => {
    renderPanel({ progress: { done: 1, total: 5, artifactsFound: 1 } });
    expect(screen.getByText("1 artifact found")).toBeInTheDocument();
  });

  it("does NOT render progress section when progress is null", () => {
    renderPanel();
    expect(screen.queryByText(/tiles reverted/)).not.toBeInTheDocument();
  });

  it("progress bar pct math tolerates total=0 (Math.max(1, total))", () => {
    renderPanel({ progress: { done: 0, total: 0, artifactsFound: 0 } });
    expect(screen.getByText("0 / 0 tiles reverted")).toBeInTheDocument();
  });
});
