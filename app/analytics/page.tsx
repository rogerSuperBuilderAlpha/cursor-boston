/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Community analytics and growth metrics for Cursor Boston — member signups, event attendance, and showcase activity.",
  alternates: { canonical: "https://cursorboston.com/analytics" },
};

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col">
      <section className="py-16 md:py-24 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold rounded-full mb-6">
            Community Stats
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">Analytics</h1>
          <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Track Cursor Boston&apos;s growth, engagement, and community momentum — updated hourly.
          </p>
        </div>
      </section>

      <AnalyticsDashboard />
    </div>
  );
}
