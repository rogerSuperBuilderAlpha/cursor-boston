/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pair Session Recordings | Cursor Boston",
  description:
    "Browse approved Cursor Boston pair programming recordings by topic, difficulty, and workflow.",
  alternates: {
    canonical: "https://cursorboston.com/recordings",
  },
};

export default function RecordingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
