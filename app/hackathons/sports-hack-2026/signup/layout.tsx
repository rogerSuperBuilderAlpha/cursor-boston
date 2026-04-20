/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import {
  SPORTS_HACK_2026_CAPACITY,
  SPORTS_HACK_2026_SHORT_NAME,
} from "@/lib/sports-hack-2026";

export const metadata: Metadata = {
  title: `${SPORTS_HACK_2026_SHORT_NAME} — Website signup & ranking`,
  description: `Claim your spot on the Cursor Boston site. Rankings use merged PRs to cursor-boston and sign-up order. Top ${SPORTS_HACK_2026_CAPACITY} are confirmed.`,
};

export default function SportsHack2026SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
