/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import { getApprovedTerms } from "@/lib/glossary";
import GlossaryListing from "./GlossaryListing";

export const metadata: Metadata = {
  title: "AI Dev Terminology Glossary",
  description: "A community-driven glossary of AI development concepts, Cursor IDE features, and modern developer terminology.",
};

export const dynamic = "force-dynamic";

export default async function GlossaryPage() {
  const terms = await getApprovedTerms();

  return (
    <main id="main-content" className="min-h-screen bg-white dark:bg-neutral-950">
      <GlossaryListing initialTerms={terms} />
    </main>
  );
}
