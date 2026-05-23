/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { readFileSync } from "fs";
import path from "path";

const TAILWIND_NEUTRAL = {
  50: "#fafafa",
  100: "#f5f5f5",
  200: "#e5e5e5",
  300: "#d4d4d4",
  400: "#a3a3a3",
  500: "#737373",
  600: "#525252",
  700: "#404040",
  800: "#262626",
  900: "#171717",
  950: "#0a0a0a",
  white: "#ffffff",
} as const;

const TAILWIND_EMERALD = {
  300: "#6ee7b7",
  400: "#34d399",
  700: "#047857",
  800: "#065f46",
} as const;

const TAILWIND_RED = {
  300: "#fca5a5",
  400: "#f87171",
  700: "#b91c1c",
  800: "#991b1b",
} as const;

function relativeLuminance(hex: string): number {
  const [red, green, blue] = [0, 2, 4]
    .map((offset) => Number.parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255)
    .map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLum = relativeLuminance(foreground);
  const backgroundLum = relativeLuminance(background);
  const lighter = Math.max(foregroundLum, backgroundLum);
  const darker = Math.min(foregroundLum, backgroundLum);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("community feed color contrast", () => {
  it("keeps feed text above WCAG AA contrast in light and dark modes", () => {
    const pairs = [
      {
        name: "secondary light text on white cards",
        foreground: TAILWIND_NEUTRAL[600],
        background: TAILWIND_NEUTRAL.white,
      },
      {
        name: "secondary dark text on neutral-900 cards",
        foreground: TAILWIND_NEUTRAL[400],
        background: TAILWIND_NEUTRAL[900],
      },
      {
        name: "secondary dark text on neutral-800 reply surfaces",
        foreground: TAILWIND_NEUTRAL[400],
        background: TAILWIND_NEUTRAL[800],
      },
      {
        name: "empty-state headline light text on white surfaces",
        foreground: TAILWIND_NEUTRAL[700],
        background: TAILWIND_NEUTRAL.white,
      },
      {
        name: "empty-state headline dark text on page background",
        foreground: TAILWIND_NEUTRAL[300],
        background: TAILWIND_NEUTRAL[950],
      },
      {
        name: "primary button text on emerald-700",
        foreground: TAILWIND_NEUTRAL.white,
        background: TAILWIND_EMERALD[700],
      },
      {
        name: "primary button text on emerald-800 hover",
        foreground: TAILWIND_NEUTRAL.white,
        background: TAILWIND_EMERALD[800],
      },
      {
        name: "light-mode action text on white",
        foreground: TAILWIND_EMERALD[700],
        background: TAILWIND_NEUTRAL.white,
      },
      {
        name: "dark-mode action text on neutral-900",
        foreground: TAILWIND_EMERALD[400],
        background: TAILWIND_NEUTRAL[900],
      },
      {
        name: "light-mode danger text on white",
        foreground: TAILWIND_RED[700],
        background: TAILWIND_NEUTRAL.white,
      },
      {
        name: "dark-mode danger text on neutral-900",
        foreground: TAILWIND_RED[400],
        background: TAILWIND_NEUTRAL[900],
      },
    ];

    for (const pair of pairs) {
      expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("does not leave feed components on known failing contrast classes", () => {
    const sourceFiles = [
      "components/feed/CommunityFeed.tsx",
      "components/feed/MessageCard.tsx",
      "components/feed/ReplyCard.tsx",
      "components/feed/PostComposer.tsx",
    ];

    for (const sourceFile of sourceFiles) {
      const source = readFileSync(path.join(process.cwd(), sourceFile), "utf8");
      const classTokens = source.match(/[A-Za-z0-9_:[\]/.-]+/g) ?? [];
      const failingForegroundTokens = classTokens.filter(
        (token) =>
          !token.startsWith("dark:") &&
          /\btext-(neutral-500|emerald-400|emerald-500|red-400)\b/.test(token),
      );

      expect(failingForegroundTokens).toEqual([]);
      expect(source).not.toMatch(/bg-emerald-500\s+text-white/);
      expect(source).not.toMatch(/hover:bg-emerald-400/);
    }
  });
});
