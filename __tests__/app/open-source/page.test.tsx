/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import OpenSourcePage from "@/app/open-source/page";

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  };
});

describe("OpenSourcePage", () => {
  it("lists where pull requests should be opened", () => {
    render(<OpenSourcePage />);

    expect(
      screen.getByRole("heading", { name: "Where to open your PR", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Open a pull request against develop \(not main\)/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText("develop").length).toBeGreaterThan(0);
    expect(screen.getByText("game-contributions")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "submission branches" })
    ).toHaveAttribute(
      "href",
      "https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/develop/docs/SUBMISSION_BRANCHES.md"
    );
  });
});
