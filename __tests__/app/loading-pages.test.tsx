/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import MembersLoading from "@/app/members/loading";
import QuestionsLoading from "@/app/questions/loading";
import CookbookLoading from "@/app/cookbook/loading";

describe("route loading skeletons", () => {
  it("renders the members loading route with member card placeholders", () => {
    render(<MembersLoading />);

    expect(screen.getAllByLabelText("Loading member card")).toHaveLength(6);
  });

  it("renders the questions loading route with a question list skeleton", () => {
    const { container } = render(<QuestionsLoading />);

    expect(screen.getByRole("status", { name: "Loading questions" })).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(20);
  });

  it("renders the cookbook loading route with entry card placeholders", () => {
    const { container } = render(<CookbookLoading />);

    expect(
      screen.getByRole("status", { name: "Loading cookbook entries" })
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(30);
  });
});
