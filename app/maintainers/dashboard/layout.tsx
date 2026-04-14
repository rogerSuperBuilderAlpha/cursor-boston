/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maintainer dashboard",
  description:
    "Weekly maintainer sync details and open pull request review queue for Cursor Boston.",
};

export default function MaintainerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
