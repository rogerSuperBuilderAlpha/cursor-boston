/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { render, screen } from "@testing-library/react";
import PrivacyPolicyPage from "@/app/privacy/page";

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

describe("PrivacyPolicyPage", () => {
  it("renders the policy heading and key sections", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole("heading", { name: "Privacy Policy", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Introduction", level: 2 })).toBeInTheDocument();
    const cookieLinks = screen.getAllByRole("link", { name: "Cookie Policy" });
    expect(cookieLinks.some((el) => el.getAttribute("href") === "/cookies")).toBe(true);
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  });
});
