/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maintainers",
  description:
    "Cursor Boston maintainers help review contributions, keep CI healthy, and grow the open source community. Apply or explore how we work together.",
};

export default function MaintainersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
