/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { SportsHack2026EventNav } from "@/components/hackathons/SportsHack2026EventNav";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/hackathons/sports-hack-2026"),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    className,
    "aria-current": ariaCurrent,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    "aria-current"?: string;
  }) => (
    <a href={href} className={className} aria-current={ariaCurrent}>
      {children}
    </a>
  ),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

function setAuth(isAdmin: boolean | null) {
  mockUseAuth.mockReturnValue({
    user: isAdmin === null ? null : ({ uid: "u1" } as never),
    userProfile: isAdmin === null ? null : ({ isAdmin } as never),
    loading: false,
  } as never);
}

describe("SportsHack2026EventNav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue("/hackathons/sports-hack-2026");
  });

  it("renders Overview, Sign up, and Submissions links for all users", () => {
    setAuth(null);
    render(<SportsHack2026EventNav />);
    expect(screen.getByRole("link", { name: /Overview/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign up & rank/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Submissions/ })).toBeInTheDocument();
  });

  it("hides Admin link from logged-out users", () => {
    setAuth(null);
    render(<SportsHack2026EventNav />);
    expect(screen.queryByRole("link", { name: /^Admin$/ })).not.toBeInTheDocument();
  });

  it("hides Admin link from non-admin signed-in users", () => {
    setAuth(false);
    render(<SportsHack2026EventNav />);
    expect(screen.queryByRole("link", { name: /^Admin$/ })).not.toBeInTheDocument();
  });

  it("shows Admin link for admin users", () => {
    setAuth(true);
    render(<SportsHack2026EventNav />);
    expect(screen.getByRole("link", { name: /^Admin$/ })).toBeInTheDocument();
  });

  it("marks the Overview link active on the overview path", () => {
    setAuth(null);
    mockUsePathname.mockReturnValue("/hackathons/sports-hack-2026");
    render(<SportsHack2026EventNav />);
    const overview = screen.getByRole("link", { name: /Overview/ });
    expect(overview).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Sign up & rank/ })).not.toHaveAttribute("aria-current");
  });

  it("marks the Sign up link active on the signup path", () => {
    setAuth(null);
    mockUsePathname.mockReturnValue("/hackathons/sports-hack-2026/signup");
    render(<SportsHack2026EventNav />);
    expect(screen.getByRole("link", { name: /Sign up & rank/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Overview/ })).not.toHaveAttribute("aria-current");
  });

  it("marks the Submissions link active on the submissions path", () => {
    setAuth(null);
    mockUsePathname.mockReturnValue("/events/cursor-boston-sports-hack-2026");
    render(<SportsHack2026EventNav />);
    expect(screen.getByRole("link", { name: /Submissions/ })).toHaveAttribute("aria-current", "page");
  });

  it("marks the Admin link active on the admin path for admins", () => {
    setAuth(true);
    mockUsePathname.mockReturnValue("/hackathons/sports-hack-2026/admin");
    render(<SportsHack2026EventNav />);
    expect(screen.getByRole("link", { name: /^Admin$/ })).toHaveAttribute("aria-current", "page");
  });
});
