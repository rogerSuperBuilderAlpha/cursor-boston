/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * OpenSSF Gold coverage push #155 — `components/icons/index.tsx`
 * (33% / 10 uncovered branches). Each icon has a `size = N` default,
 * so we exercise both the "size override" and "default size" branches
 * for each icon plus a couple of extra prop forwarding cases.
 */
import { render } from "@testing-library/react";
import {
  DiscordIcon,
  GitHubIcon,
  CursorIcon,
  LinkedInIcon,
  XIcon,
  CalendarIcon,
  LayersIcon,
  PlusIcon,
  UserCardIcon,
  CloseIcon,
  EmailIcon,
  AgentIcon,
  StackIcon,
  EyeIcon,
  EyeOffIcon,
} from "@/components/icons";

function getSvg(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("svg not rendered");
  return svg;
}

const allIcons = [
  { name: "DiscordIcon", Cmp: DiscordIcon, defaultSize: "14" },
  { name: "GitHubIcon", Cmp: GitHubIcon, defaultSize: "14" },
  { name: "CursorIcon", Cmp: CursorIcon, defaultSize: "14" },
  { name: "LinkedInIcon", Cmp: LinkedInIcon, defaultSize: "14" },
  { name: "XIcon", Cmp: XIcon, defaultSize: "14" },
  { name: "CalendarIcon", Cmp: CalendarIcon, defaultSize: "20" },
  { name: "LayersIcon", Cmp: LayersIcon, defaultSize: "20" },
  { name: "PlusIcon", Cmp: PlusIcon, defaultSize: "20" },
  { name: "UserCardIcon", Cmp: UserCardIcon, defaultSize: "20" },
  { name: "CloseIcon", Cmp: CloseIcon, defaultSize: "24" },
  { name: "EmailIcon", Cmp: EmailIcon, defaultSize: "16" },
  { name: "AgentIcon", Cmp: AgentIcon, defaultSize: "16" },
  { name: "StackIcon", Cmp: StackIcon, defaultSize: "20" },
  { name: "EyeIcon", Cmp: EyeIcon, defaultSize: "14" },
  { name: "EyeOffIcon", Cmp: EyeOffIcon, defaultSize: "14" },
];

describe("components/icons", () => {
  it.each(allIcons)(
    "$name renders an svg with its default size",
    ({ Cmp, defaultSize }) => {
      const { container } = render(<Cmp />);
      const svg = getSvg(container);
      expect(svg.getAttribute("width")).toBe(defaultSize);
      expect(svg.getAttribute("height")).toBe(defaultSize);
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
  );

  it.each(allIcons)(
    "$name honors an explicit size prop",
    ({ Cmp }) => {
      const { container } = render(<Cmp size={48} />);
      const svg = getSvg(container);
      expect(svg.getAttribute("width")).toBe("48");
      expect(svg.getAttribute("height")).toBe("48");
    }
  );

  it("forwards arbitrary SVG props (className, data-*)", () => {
    const { container } = render(
      <DiscordIcon className="foo" data-testid="discord-svg" />
    );
    const svg = getSvg(container);
    expect(svg.getAttribute("class")).toBe("foo");
    expect(svg.getAttribute("data-testid")).toBe("discord-svg");
  });

  it("allows overriding fill on icons with `fill='currentColor'`", () => {
    const { container } = render(<GitHubIcon fill="red" />);
    expect(getSvg(container).getAttribute("fill")).toBe("red");
  });
});
