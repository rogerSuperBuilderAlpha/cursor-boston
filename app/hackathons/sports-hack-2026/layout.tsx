/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import {
  SPORTS_HACK_2026_LOCATION,
  SPORTS_HACK_2026_NAME,
} from "@/lib/sports-hack-2026";

export const metadata: Metadata = {
  title: `${SPORTS_HACK_2026_NAME} — Cursor Boston`,
  description: `Boston Tech Week Speakers & Workshop at Hult International — Tuesday May 26, 2026, 10:00 AM – 4:00 PM ET, ${SPORTS_HACK_2026_LOCATION}. Guest lecture from Antonio Mele (LSE), lunch, two-hour hackathon sprint, and live pitches from Cursor Boston and AIC.`,
};

export default function SportsHack2026Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
