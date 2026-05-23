/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import Link from "next/link";
import {
  Layers3,
  LibraryBig,
  ListChecks,
  Tags,
} from "lucide-react";
import {
  PROMPT_TEMPLATE_CATEGORIES,
  PROMPT_TEMPLATES,
  getTemplateStacks,
} from "@/lib/prompt-templates";

export default function PromptTemplatesPage() {
  const stacks = getTemplateStacks();
  const variantCount = PROMPT_TEMPLATES.reduce(
    (count, template) => count + template.variants.length,
    0
  );

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <section className="border-b border-neutral-200 bg-white px-6 py-12 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <LibraryBig className="h-4 w-4" aria-hidden="true" />
            Prompt Template Library
          </div>
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <div>
              <h1 className="max-w-3xl text-3xl font-bold text-foreground md:text-5xl">
                Reusable Cursor prompts with stack variants
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-400 md:text-lg">
                Start from structured templates, then choose the variant that
                matches your app stack and workflow.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 self-start">
              <StatCard label="Templates" value={String(PROMPT_TEMPLATES.length)} />
              <StatCard label="Variants" value={String(variantCount)} />
              <StatCard label="Stacks" value={String(stacks.length)} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-5 flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
          <Tags className="h-4 w-4" aria-hidden="true" />
          {stacks.join(" / ")}
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {PROMPT_TEMPLATES.map((template) => (
            <article
              key={template.id}
              className="flex min-h-[320px] flex-col rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                  {PROMPT_TEMPLATE_CATEGORIES[template.category]}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {template.difficulty}
                </span>
              </div>

              <h2 className="text-xl font-semibold text-foreground">
                {template.title}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {template.summary}
              </p>

              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <Layers3 className="h-4 w-4" aria-hidden="true" />
                  {template.variants.length} stack variants
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <ListChecks className="h-4 w-4" aria-hidden="true" />
                  {template.placeholders.length} placeholders
                </div>
              </div>

              <Link
                href={`/templates/${template.id}`}
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Open template
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
    </div>
  );
}
