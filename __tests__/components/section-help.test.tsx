/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `components/SectionHelp.tsx` (47% branch, 9
 * uncovered). Covers: closed by default, opens via toggle, defaultOpen
 * prop, hasMore=false (no toggle), FAQ-only, links-only (internal +
 * external mix), className override, Show less label after open.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import { SectionHelp } from "@/components/SectionHelp";

describe("SectionHelp", () => {
  it("renders intro and title without disclosure when no faq/links given", () => {
    render(<SectionHelp title="About" intro="Plain intro" />);
    expect(screen.getByText("About")).toBeInTheDocument();
    expect(screen.getByText("Plain intro")).toBeInTheDocument();
    // No "Learn more" toggle when hasMore=false.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("treats empty faq and empty links arrays as hasMore=false", () => {
    render(
      <SectionHelp title="About" intro="Hi" faq={[]} links={[]} />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders 'Learn more' toggle when faq is provided", () => {
    render(
      <SectionHelp
        title="Help"
        intro="Intro"
        faq={[{ q: "What?", a: "Answer." }]}
      />,
    );
    const btn = screen.getByRole("button", { name: /Learn more/ });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-expanded", "false");
    // FAQ items not visible until opened.
    expect(screen.queryByText("What?")).not.toBeInTheDocument();
  });

  it("opens disclosure when 'Learn more' clicked and reveals FAQ items", () => {
    render(
      <SectionHelp
        title="Help"
        intro="Intro"
        faq={[
          { q: "Question 1", a: "Answer 1" },
          { q: "Question 2", a: "Answer 2" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Learn more/ }));
    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(screen.getByText("Question 2")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Show less/ });
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses back to 'Learn more' after a second click", () => {
    render(
      <SectionHelp
        title="Help"
        intro="Intro"
        faq={[{ q: "Q", a: "A" }]}
      />,
    );
    const btn = screen.getByRole("button");
    fireEvent.click(btn); // open
    fireEvent.click(btn); // close
    expect(screen.getByRole("button", { name: /Learn more/ })).toBeInTheDocument();
    expect(screen.queryByText("Q")).not.toBeInTheDocument();
  });

  it("starts open when defaultOpen=true", () => {
    render(
      <SectionHelp
        title="Help"
        intro="Intro"
        faq={[{ q: "Why?", a: "Because." }]}
        defaultOpen
      />,
    );
    expect(screen.getByText("Why?")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("renders internal Link for non-external link entries", () => {
    render(
      <SectionHelp
        title="Help"
        intro="Intro"
        links={[{ label: "Docs page", href: "/docs/page" }]}
        defaultOpen
      />,
    );
    const link = screen.getByRole("link", { name: "Docs page" });
    expect(link).toHaveAttribute("href", "/docs/page");
    // Internal Link should not open in a new tab.
    expect(link).not.toHaveAttribute("target");
  });

  it("renders external anchor with target=_blank and ↗ glyph", () => {
    render(
      <SectionHelp
        title="Help"
        intro="Intro"
        links={[{ label: "External docs", href: "https://example.com", external: true }]}
        defaultOpen
      />,
    );
    const link = screen.getByRole("link", { name: /External docs/ });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.textContent).toMatch("↗");
  });

  it("renders both faq and links together when both supplied", () => {
    render(
      <SectionHelp
        title="Mixed"
        intro={<span data-testid="intro-node">Rich intro</span>}
        faq={[{ q: "Faq Q", a: <em>Faq A</em> }]}
        links={[
          { label: "Internal", href: "/x" },
          { label: "Ext", href: "https://ex.com", external: true },
        ]}
        defaultOpen
      />,
    );
    expect(screen.getByTestId("intro-node")).toBeInTheDocument();
    expect(screen.getByText("Faq Q")).toBeInTheDocument();
    expect(screen.getByText("Faq A")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Internal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ext/ })).toBeInTheDocument();
  });

  it("applies a custom className when supplied", () => {
    const { container } = render(
      <SectionHelp
        title="Styled"
        intro="Intro"
        className="my-extra-class"
      />,
    );
    const aside = container.querySelector("aside");
    expect(aside?.className).toMatch(/my-extra-class/);
  });

  it("omits the className suffix gracefully when not provided", () => {
    const { container } = render(<SectionHelp title="No Class" intro="Intro" />);
    const aside = container.querySelector("aside");
    // Should not append "undefined" or "null" to the class string.
    expect(aside?.className).not.toMatch(/undefined|null/);
  });
});
