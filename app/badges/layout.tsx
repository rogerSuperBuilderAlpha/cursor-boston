/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";

const title = "Community Badges | Cursor Boston";
const description =
  "Earn badges for your contributions and milestones in the Cursor Boston community. Track your achievements and unlock new badges.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  alternates: {
    canonical: "https://cursorboston.com/badges",
  },
};

export default function BadgesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
