/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PydataLockedBanner } from "@/components/events/PydataLockedBanner";

describe("PydataLockedBanner", () => {
  it("renders the lockout copy + dismiss button", () => {
    render(<PydataLockedBanner />);
    expect(
      screen.getByText(/PyData × Cursor Boston attendance is locked/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /dismiss notice/i })
    ).toBeInTheDocument();
  });

  it("disappears after the user clicks dismiss", async () => {
    const user = userEvent.setup();
    render(<PydataLockedBanner />);
    await user.click(screen.getByRole("button", { name: /dismiss notice/i }));
    expect(
      screen.queryByText(/attendance is locked/i)
    ).not.toBeInTheDocument();
  });
});
