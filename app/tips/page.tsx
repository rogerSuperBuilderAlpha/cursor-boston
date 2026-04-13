/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import { getPublishedTips } from "@/lib/tips";
import TipsArchive from "./TipsArchive";

export const metadata: Metadata = {
  title: "Weekly AI Dev Tips",
  description:
    "Community-sourced Cursor workflow hacks, keyboard shortcuts, and prompt tricks — delivered weekly.",
};

export const dynamic = "force-dynamic";

export default async function TipsPage() {
  const tips = await getPublishedTips();

  return (
    <main id="main-content" className="min-h-screen bg-white dark:bg-neutral-950">
      <TipsArchive initialTips={tips} />
    </main>
  );
}
