/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find a Team",
  description: "Join the team pool to find teammates for Cursor Boston hackathons.",
};

export default function PoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
