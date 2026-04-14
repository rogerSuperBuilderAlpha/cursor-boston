/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apply to be a maintainer",
  description:
    "Apply to help steward the Cursor Boston open source project. Connect GitHub and Discord on your profile, then open a pull request with your application JSON.",
};

export default function MaintainerApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
