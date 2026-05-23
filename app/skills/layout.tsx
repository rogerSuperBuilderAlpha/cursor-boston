/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Skills Passport | Cursor Boston",
  description:
    "Track AI development skill progress through Cursor Boston badges and community milestones.",
  alternates: {
    canonical: "https://cursorboston.com/skills",
  },
};

export default function SkillsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
