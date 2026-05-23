/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Monthly Code Challenges | Cursor Boston",
  description:
    "Monthly Cursor Boston coding challenges focused on AI-assisted development workflows.",
  alternates: {
    canonical: "https://cursorboston.com/challenges",
  },
};

export default function ChallengesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
