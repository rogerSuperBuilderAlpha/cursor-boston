/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hack-a-Sprint 2026 — Pre-event instructions",
  description:
    "Everything you need to prepare for Hack-a-Sprint 2026: the challenge, Inkbox SDK setup, schedule, and what to bring.",
};

export default function HackASprint2026InstructionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
