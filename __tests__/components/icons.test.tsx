/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `components/icons/index.tsx` was at 33.3%
 * branches (10 uncovered). Every export is a default-prop SVG, so the
 * uncovered branches are the `size = N` defaults and the spread-props
 * paths. We render each icon (a) with no props to hit the default-size
 * branch and (b) with a custom size + extra attribute to hit the
 * override + spread branch, then assert the rendered svg's
 * width/height/data-* attributes.
 */
import React from "react";
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

interface IconCase {
  name: string;
  Component: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>;
  defaultSize: number;
}

const cases: IconCase[] = [
  { name: "DiscordIcon", Component: DiscordIcon, defaultSize: 14 },
  { name: "GitHubIcon", Component: GitHubIcon, defaultSize: 14 },
  { name: "CursorIcon", Component: CursorIcon, defaultSize: 14 },
  { name: "LinkedInIcon", Component: LinkedInIcon, defaultSize: 14 },
  { name: "XIcon", Component: XIcon, defaultSize: 14 },
  { name: "CalendarIcon", Component: CalendarIcon, defaultSize: 20 },
  { name: "LayersIcon", Component: LayersIcon, defaultSize: 20 },
  { name: "PlusIcon", Component: PlusIcon, defaultSize: 20 },
  { name: "UserCardIcon", Component: UserCardIcon, defaultSize: 20 },
  { name: "CloseIcon", Component: CloseIcon, defaultSize: 24 },
  { name: "EmailIcon", Component: EmailIcon, defaultSize: 16 },
  { name: "AgentIcon", Component: AgentIcon, defaultSize: 16 },
  { name: "StackIcon", Component: StackIcon, defaultSize: 20 },
  { name: "EyeIcon", Component: EyeIcon, defaultSize: 14 },
  { name: "EyeOffIcon", Component: EyeOffIcon, defaultSize: 14 },
];

describe("components/icons", () => {
  describe.each(cases)("$name", ({ name, Component, defaultSize }) => {
    it(`renders with default size ${defaultSize}`, () => {
      const { container } = render(<Component data-testid={name} />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("width")).toBe(String(defaultSize));
      expect(svg?.getAttribute("height")).toBe(String(defaultSize));
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
    });

    it("respects custom size and spreads extra props", () => {
      const { container } = render(
        <Component size={42} data-foo="bar" className="custom-cls" />,
      );
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("width")).toBe("42");
      expect(svg?.getAttribute("height")).toBe("42");
      expect(svg?.getAttribute("data-foo")).toBe("bar");
      expect(svg?.getAttribute("class")).toBe("custom-cls");
    });
  });

  it("does not crash when rendering all icons together (smoke)", () => {
    const all = cases.map(({ Component }, i) => (
      <Component key={i} />
    ));
    const { container } = render(<div>{all}</div>);
    expect(container.querySelectorAll("svg")).toHaveLength(cases.length);
  });
});
