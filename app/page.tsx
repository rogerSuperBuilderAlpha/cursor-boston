/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import TrashTalkDemo from "@/components/TrashTalkDemo";

export const metadata: Metadata = {
  title: "TrashTalk - Live Sports AI Commentary",
  description:
    "Pick your side in Celtics vs Knicks and let biased AI glaze your team while roasting the rival live.",
};

export default function Home() {
  return <TrashTalkDemo />;
}
