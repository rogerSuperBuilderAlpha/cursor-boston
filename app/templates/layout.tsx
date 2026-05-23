/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prompt Templates | Cursor Boston",
  description:
    "Browse reusable Cursor prompt templates with stack-specific variants from the Cursor Boston community.",
  alternates: {
    canonical: "https://cursorboston.com/templates",
  },
};

export default function TemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
