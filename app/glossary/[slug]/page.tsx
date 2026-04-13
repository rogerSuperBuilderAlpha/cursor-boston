/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTermBySlug } from "@/lib/glossary";
import GlossaryDetail from "./GlossaryDetail";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const term = await getTermBySlug(slug);

  if (!term) {
    return {
      title: "Term Not Found",
    };
  }

  return {
    title: `${term.term} | AI Dev Glossary`,
    description: term.definition.slice(0, 160),
    openGraph: {
      title: `${term.term} - Cursor Boston Glossary`,
      description: term.definition.slice(0, 160),
      type: "article",
    },
  };
}

export const dynamic = "force-dynamic";

export default async function TermDetailPage({ params }: Props) {
  const { slug } = await params;
  const term = await getTermBySlug(slug);

  if (!term) {
    notFound();
  }

  return (
    <main id="main-content" className="min-h-screen bg-white dark:bg-neutral-950">
      <GlossaryDetail term={term} />
    </main>
  );
}
