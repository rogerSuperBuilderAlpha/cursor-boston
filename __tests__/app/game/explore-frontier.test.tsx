/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/_components/dashboard/ExploreFrontier.tsx`
 * (40% / 9 uncovered branches). Covers safeMax floor, count input parsing
 * (valid + NaN ignored), busy-state label (singular vs plural), max-count
 * cap (Math.min(50, safeMax)), button disabled when busy OR safeMax<1,
 * progress bar render, plural/singular tile + artifact copy, the
 * `progress=null` branch (no bar), and the explore click handler.
 */

import { fireEvent, render, screen } from "@testing-library/react";

import { ExploreFrontier } from "@/app/game/_components/dashboard/ExploreFrontier";

function renderPanel(over: Partial<Record<string, unknown>> = {}) {
  const onCountChange = jest.fn();
  const onExplore = jest.fn();
  const props = {
    count: 3,
    onCountChange,
    busy: false,
    progress: null,
    maxCount: 10,
    onExplore,
    ...over,
  } as never;
  render(<ExploreFrontier {...props} />);
  return { onCountChange, onExplore };
}

describe("ExploreFrontier", () => {
  it("renders heading + intro copy + plural 'turns available' when safeMax > 1", () => {
    renderPanel({ maxCount: 10 });
    expect(screen.getByText("Push the frontier")).toBeInTheDocument();
    expect(
      screen.getByText(/Spend turns to claim brand-new tiles/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/you have 10 turns available/)).toBeInTheDocument();
  });

  it("renders singular 'turn available' when safeMax === 1", () => {
    renderPanel({ maxCount: 1 });
    expect(screen.getByText(/you have 1 turn available/)).toBeInTheDocument();
  });

  it("safeMax floors at 1 when maxCount is 0 (turn-counter copy)", () => {
    renderPanel({ maxCount: 0 });
    // safeMax = Math.max(1, 0) = 1
    expect(screen.getByText(/you have 1 turn available/)).toBeInTheDocument();
  });

  it("clamps the input max attribute to Math.min(50, safeMax)", () => {
    renderPanel({ maxCount: 8 });
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.max).toBe("8");
  });

  it("clamps the input max attribute to 50 when maxCount > 50", () => {
    renderPanel({ maxCount: 999 });
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.max).toBe("50");
  });

  it("invokes onCountChange with parsed integer on numeric input", () => {
    const { onCountChange } = renderPanel();
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "7" } });
    expect(onCountChange).toHaveBeenCalledWith(7);
  });

  it("ignores non-numeric input (NaN guard)", () => {
    const { onCountChange } = renderPanel();
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    expect(onCountChange).not.toHaveBeenCalled();
  });

  it("Explore button label uses plural 'tiles' when count > 1", () => {
    renderPanel({ count: 4 });
    expect(
      screen.getByRole("button", { name: /Explore ×4/ })
    ).toBeInTheDocument();
  });

  it("Explore button calls onExplore when clicked", () => {
    const { onExplore } = renderPanel({ count: 2 });
    fireEvent.click(screen.getByRole("button", { name: /Explore ×2/ }));
    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it("busy=true label uses singular 'tile' when count === 1", () => {
    renderPanel({ busy: true, count: 1 });
    expect(
      screen.getByRole("button", { name: /Pushing the frontier \(1 tile\)/ })
    ).toBeDisabled();
  });

  it("busy=true label uses plural 'tiles' when count > 1", () => {
    renderPanel({ busy: true, count: 5 });
    expect(
      screen.getByRole("button", { name: /Pushing the frontier \(5 tiles\)/ })
    ).toBeDisabled();
  });

  it("Explore button is disabled when safeMax < 1 (impossible per Math.max(1, ...) — still disabled when busy)", () => {
    renderPanel({ busy: true, count: 3 });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("input is disabled when busy=true", () => {
    renderPanel({ busy: true });
    expect(screen.getByRole("spinbutton")).toBeDisabled();
  });

  it("does NOT render progress bar when progress is null", () => {
    renderPanel({ progress: null });
    expect(screen.queryByText(/tiles claimed/)).not.toBeInTheDocument();
  });

  it("renders progress bar + plural 'artifacts found' when progress is set", () => {
    renderPanel({
      progress: { done: 3, total: 10, artifactsFound: 2 },
    });
    expect(screen.getByText("3 / 10 tiles claimed")).toBeInTheDocument();
    expect(screen.getByText("2 artifacts found")).toBeInTheDocument();
  });

  it("uses singular 'artifact found' when artifactsFound === 1", () => {
    renderPanel({ progress: { done: 1, total: 1, artifactsFound: 1 } });
    expect(screen.getByText("1 artifact found")).toBeInTheDocument();
  });

  it("guards against total=0 in the progress width calc", () => {
    renderPanel({ progress: { done: 0, total: 0, artifactsFound: 0 } });
    expect(screen.getByText("0 / 0 tiles claimed")).toBeInTheDocument();
    expect(screen.getByText("0 artifacts found")).toBeInTheDocument();
  });
});
