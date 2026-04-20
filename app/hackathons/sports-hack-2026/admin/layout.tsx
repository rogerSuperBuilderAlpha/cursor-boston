/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import { SPORTS_HACK_2026_SHORT_NAME } from "@/lib/sports-hack-2026";

export const metadata: Metadata = {
  title: `${SPORTS_HACK_2026_SHORT_NAME} — Admin Check-In`,
  description: "Door check-in for organizers.",
  robots: { index: false, follow: false },
};

export default function SportsHack2026AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
