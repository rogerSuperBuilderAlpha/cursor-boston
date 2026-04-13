/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";

const title = "Pair Programming Requests | Cursor Boston";
const description =
  "Browse and manage your pair programming requests with the Boston Cursor community.";

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
    canonical: "https://cursorboston.com/pair/requests",
  },
};

export default function PairRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
