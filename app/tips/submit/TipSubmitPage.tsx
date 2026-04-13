/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TipSubmitForm } from "@/components/tips/TipSubmitForm";

export default function TipSubmitPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link
        href="/tips"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tips
      </Link>
      <h1 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
        Submit a Tip
      </h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-10">
        Share a 2-3 sentence Cursor workflow hack, keyboard shortcut, or prompt trick.
        Curated tips are sent to subscribers every Monday.
      </p>
      <TipSubmitForm />
    </div>
  );
}
