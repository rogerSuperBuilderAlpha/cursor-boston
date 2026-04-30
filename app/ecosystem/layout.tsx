/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Mass AI Ecosystem",
  description:
    "Directory of universities, accelerators, AI organizations, research labs, nonprofits, and venture firms shaping AI and technology across Massachusetts.",
  alternates: { canonical: "https://cursorboston.com/ecosystem" },
};

export default function EcosystemLayout({ children }: { children: ReactNode }) {
  return children;
}
