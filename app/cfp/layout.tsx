/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";

const title = "Call for Papers | Cursor Boston";
const description =
  "Submit your talk proposal for upcoming Cursor Boston events. Share your experience with AI-assisted development and the Cursor community.";

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
    canonical: "https://cursorboston.com/cfp",
  },
};

export default function CfpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
