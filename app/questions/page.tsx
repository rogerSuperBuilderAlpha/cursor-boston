/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import { QuestionsListing } from "@/components/questions/QuestionsListing";

export const metadata: Metadata = {
  title: "Community Q&A | Cursor Boston",
  description:
    "Ask and answer questions about Cursor workflows, prompting patterns, and AI-assisted development.",
};

export default function QuestionsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <QuestionsListing />
    </main>
  );
}
