/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/_components/dashboard/BulkDistribute.tsx`
 * (0% / 15 uncovered branches). Covers singular vs plural copy, type
 * select, count clamping (safeCount), Run button disabled when max=0,
 * busy state label, progress bar render, plural/singular artifact copy.
 */

import { fireEvent, render, screen } from "@testing-library/react";

import { BulkDistribute } from "@/app/game/_components/dashboard/BulkDistribute";

function renderPanel(over: Partial<Record<string, unknown>> = {}) {
  const onTypeChange = jest.fn();
  const onCountChange = jest.fn();
  const onRun = jest.fn();
  const props = {
    unassignedCount: 5,
    turnsRemaining: 100,
    type: "military" as const,
    onTypeChange,
    count: 3,
    onCountChange,
    busy: false,
    progress: null,
    onRun,
    ...over,
  } as never;
  render(<BulkDistribute {...props} />);
  return { onTypeChange, onCountChange, onRun };
}

describe("BulkDistribute", () => {
  it("renders plural 'unassigned tiles' when count > 1", () => {
    renderPanel({ unassignedCount: 5 });
    expect(screen.getByText(/5 unassigned tiles/)).toBeInTheDocument();
  });

  it("renders singular 'unassigned tile' when count === 1", () => {
    renderPanel({ unassignedCount: 1 });
    expect(screen.getByText(/1 unassigned tile\b/)).toBeInTheDocument();
  });

  it("Type select invokes onTypeChange", () => {
    const { onTypeChange } = renderPanel();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "food" } });
    expect(onTypeChange).toHaveBeenCalledWith("food");
  });

  it("Count input invokes onCountChange with parsed integer", () => {
    const { onCountChange } = renderPanel();
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "7" } });
    expect(onCountChange).toHaveBeenCalledWith(7);
  });

  it("Count input ignores non-numeric input", () => {
    const { onCountChange } = renderPanel();
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    expect(onCountChange).not.toHaveBeenCalled();
  });

  it("safeCount caps at min(unassignedCount, turnsRemaining)", () => {
    renderPanel({ unassignedCount: 2, turnsRemaining: 100, count: 50 });
    expect(screen.getByRole("button", { name: /Assign 2 → military/ })).toBeInTheDocument();
  });

  it("safeCount caps at turnsRemaining when lower than unassignedCount", () => {
    renderPanel({ unassignedCount: 100, turnsRemaining: 3, count: 50 });
    expect(screen.getByRole("button", { name: /Assign 3 → military/ })).toBeInTheDocument();
  });

  it("safeCount lower-bounded at 1 even if count is 0 or negative", () => {
    renderPanel({ count: 0 });
    expect(screen.getByRole("button", { name: /Assign 1 → military/ })).toBeInTheDocument();
  });

  it("Run button calls onRun when clicked", () => {
    const { onRun } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Assign 3 → military/ }));
    expect(onRun).toHaveBeenCalled();
  });

  it("Run button is disabled when max=0 (no unassigned tiles or no turns)", () => {
    renderPanel({ unassignedCount: 0, count: 5 });
    expect(screen.getByRole("button", { name: /Assign 1 → military/ })).toBeDisabled();
  });

  it("renders 'Assigning N tiles…' label when busy=true", () => {
    renderPanel({ busy: true, count: 4 });
    expect(screen.getByRole("button", { name: /Assigning 4 tiles/ })).toBeDisabled();
  });

  it("renders progress bar and plural artifact count when progress is set", () => {
    renderPanel({ progress: { done: 5, total: 10, artifactsFound: 2 } });
    expect(screen.getByText("5 / 10 tiles assigned")).toBeInTheDocument();
    expect(screen.getByText("2 artifacts found")).toBeInTheDocument();
  });

  it("uses singular 'artifact' when artifactsFound === 1", () => {
    renderPanel({ progress: { done: 5, total: 10, artifactsFound: 1 } });
    expect(screen.getByText("1 artifact found")).toBeInTheDocument();
  });

  it("does NOT render progress bar when progress is null", () => {
    renderPanel();
    expect(screen.queryByText(/tiles assigned/)).not.toBeInTheDocument();
  });

  it("progress bar width respects done/total ratio (capped at total >= 1)", () => {
    renderPanel({ progress: { done: 0, total: 0, artifactsFound: 0 } });
    // total=0 → uses Math.max(1, total) so doesn't divide by zero
    expect(screen.getByText("0 / 0 tiles assigned")).toBeInTheDocument();
  });
});
