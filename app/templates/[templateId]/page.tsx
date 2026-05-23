/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PromptMarkdown } from "@/components/cookbook/PromptMarkdown";
import {
  PROMPT_TEMPLATE_CATEGORIES,
  PROMPT_TEMPLATES,
  getPromptTemplateById,
  getTemplatePlaceholderTokens,
} from "@/lib/prompt-templates";

const SITE_URL = "https://cursorboston.com";

interface Props {
  params: Promise<{ templateId: string }>;
}

export function generateStaticParams() {
  return PROMPT_TEMPLATES.map((template) => ({
    templateId: template.id,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { templateId } = await params;
  const template = getPromptTemplateById(templateId);

  if (!template) {
    return {
      title: "Prompt Template Not Found",
    };
  }

  const title = `${template.title} | Cursor Boston Templates`;
  const url = `${SITE_URL}/templates/${template.id}`;

  return {
    title,
    description: template.summary,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: template.summary,
      type: "article",
      url,
    },
    twitter: {
      card: "summary",
      title,
      description: template.summary,
    },
  };
}

function buildJsonLd(template: NonNullable<ReturnType<typeof getPromptTemplateById>>) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: template.title,
    description: template.summary,
    text: template.basePrompt,
    url: `${SITE_URL}/templates/${template.id}`,
    isPartOf: {
      "@type": "CreativeWorkSeries",
      name: "Cursor Boston Prompt Template Library",
      url: `${SITE_URL}/templates`,
    },
    keywords: [
      PROMPT_TEMPLATE_CATEGORIES[template.category],
      ...template.placeholders,
      ...template.variants.map((variant) => variant.stack),
    ].join(", "),
    publisher: {
      "@type": "Organization",
      name: "Cursor Boston",
      url: SITE_URL,
    },
  };
}

export default async function PromptTemplateDetailPage({ params }: Props) {
  const { templateId } = await params;
  const template = getPromptTemplateById(templateId);

  if (!template) {
    notFound();
  }

  const placeholderTokens = getTemplatePlaceholderTokens(template);
  const jsonLd = buildJsonLd(template);

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav
        aria-label="Breadcrumb"
        className="border-b border-neutral-200 bg-white px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <ol className="mx-auto flex max-w-5xl items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <li>
            <Link href="/templates" className="hover:text-foreground">
              Templates
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="truncate text-foreground">{template.title}</li>
        </ol>
      </nav>

      <article className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-300">
              {PROMPT_TEMPLATE_CATEGORIES[template.category]}
            </span>
            <span className="rounded-full bg-neutral-200 px-3 py-1 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {template.difficulty}
            </span>
            <span className="rounded-full bg-neutral-200 px-3 py-1 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {template.variants.length} variants
            </span>
          </div>

          <h1 className="text-3xl font-bold text-neutral-950 dark:text-white md:text-5xl">
            {template.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-700 dark:text-neutral-300">
            {template.summary}
          </p>
        </header>

        <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-lg font-semibold text-foreground">
            Placeholders
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {placeholderTokens.map((placeholder) => (
              <code
                key={placeholder}
                className="rounded-md bg-neutral-100 px-2.5 py-1 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              >
                {`{{${placeholder}}}`}
              </code>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="base-template-heading"
          className="mb-8 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="border-b border-neutral-200 bg-neutral-100 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-800/70">
            <h2
              id="base-template-heading"
              className="text-sm font-semibold uppercase text-neutral-500 dark:text-neutral-400"
            >
              Base template
            </h2>
          </div>
          <PromptMarkdown
            content={template.basePrompt}
            className="px-4 py-4 text-sm md:px-6 md:py-5"
          />
        </section>

        <section aria-labelledby="variant-heading">
          <h2 id="variant-heading" className="mb-4 text-lg font-semibold text-foreground">
            Stack Variants
          </h2>
          <div className="space-y-5">
            {template.variants.map((variant) => (
              <article
                key={variant.id}
                className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {variant.stack}
                      </h3>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                        {variant.useCase}
                      </p>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                      Variant
                    </span>
                  </div>
                </div>

                <PromptMarkdown
                  content={variant.prompt}
                  className="px-4 py-4 text-sm md:px-6 md:py-5"
                />

                <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-950">
                  <h4 className="text-sm font-semibold text-foreground">Notes</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
                    {variant.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
