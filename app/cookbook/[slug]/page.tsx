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
import { CATEGORY_LABELS } from "@/lib/cookbook-labels";
import { getCookbookEntryById } from "@/lib/cookbook-entries";
import { formatCookbookDate } from "@/lib/format-cookbook-date";
import type { CookbookEntry } from "@/types/cookbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = "https://cursorboston.com";
const DEFAULT_IMAGE = "/cursor-boston-logo.png";

interface Props {
  params: Promise<{ slug: string }>;
}

function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function cookbookEntryUrl(entry: CookbookEntry): string {
  return absoluteUrl(entry.seo?.canonicalUrl ?? `/cookbook/${entry.id}`);
}

function metadataTitle(entry: CookbookEntry): string {
  return entry.seo?.title ?? `${entry.title} | Cursor Boston Cookbook`;
}

function metadataDescription(entry: CookbookEntry): string {
  return entry.seo?.description ?? entry.description;
}

function metadataImage(entry: CookbookEntry): string {
  return absoluteUrl(entry.seo?.image ?? DEFAULT_IMAGE);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getCookbookEntryById(slug);

  if (!entry) {
    return {
      title: "Cookbook Entry Not Found",
    };
  }

  const title = metadataTitle(entry);
  const description = metadataDescription(entry);
  const image = metadataImage(entry);
  const canonical = cookbookEntryUrl(entry);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: entry.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    alternates: {
      canonical,
    },
  };
}

function buildJsonLd(entry: CookbookEntry) {
  const url = cookbookEntryUrl(entry);
  const keywords = [...entry.tags, ...entry.worksWith].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: entry.title,
    description: entry.description,
    text: entry.promptContent,
    url,
    image: metadataImage(entry),
    dateCreated: entry.createdAt || undefined,
    keywords: keywords.length > 0 ? keywords.join(", ") : undefined,
    creator: {
      "@type": "Person",
      name: entry.authorDisplayName || "Cursor Boston member",
    },
    publisher: {
      "@type": "Organization",
      name: "Cursor Boston",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(DEFAULT_IMAGE),
      },
    },
    isPartOf: {
      "@type": "CreativeWorkSeries",
      name: "Cursor Boston Prompt & Rules Cookbook",
      url: `${SITE_URL}/cookbook`,
    },
    about: CATEGORY_LABELS[entry.category],
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: entry.upCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/DislikeAction",
        userInteractionCount: entry.downCount,
      },
    ],
  };
}

export default async function CookbookEntryPage({ params }: Props) {
  const { slug } = await params;
  const entry = await getCookbookEntryById(slug);

  if (!entry) {
    notFound();
  }

  const jsonLd = buildJsonLd(entry);
  const netScore = entry.upCount - entry.downCount;

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav
        className="border-b border-neutral-200 dark:border-neutral-800 px-6 py-4"
        aria-label="Breadcrumb"
      >
        <ol className="mx-auto flex max-w-4xl items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <li>
            <Link href="/cookbook" className="hover:text-foreground">
              Cookbook
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="truncate text-foreground">{entry.title}</li>
        </ol>
      </nav>

      <article className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-300">
              {CATEGORY_LABELS[entry.category]}
            </span>
            {entry.worksWith.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-200 px-3 py-1 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {tag}
              </span>
            ))}
          </div>

          <h1 className="text-3xl font-bold tracking-normal text-neutral-950 dark:text-white md:text-5xl">
            {entry.title}
          </h1>
          <p className="mt-4 text-lg leading-8 text-neutral-700 dark:text-neutral-300">
            {entry.description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
            <Link
              href={`/members?search=${encodeURIComponent(entry.authorDisplayName)}`}
              className="hover:text-foreground"
            >
              by {entry.authorDisplayName || "Cursor Boston member"}
            </Link>
            {entry.createdAt ? (
              <>
                <span aria-hidden="true">/</span>
                <time dateTime={entry.createdAt}>
                  {formatCookbookDate(entry.createdAt)}
                </time>
              </>
            ) : null}
            <span aria-hidden="true">/</span>
            <span>{netScore >= 0 ? `+${netScore}` : netScore} net score</span>
          </div>
        </header>

        <section
          aria-labelledby="cookbook-entry-prompt"
          className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="border-b border-neutral-200 bg-neutral-100 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-800/70">
            <h2
              id="cookbook-entry-prompt"
              className="text-sm font-semibold uppercase text-neutral-500 dark:text-neutral-400"
            >
              Full prompt
            </h2>
          </div>
          <PromptMarkdown
            content={entry.promptContent}
            className="px-4 py-4 text-sm md:px-6 md:py-5"
          />
        </section>

        {entry.tags.length > 0 ? (
          <section aria-label="Tags" className="mt-8 flex flex-wrap gap-2">
            {entry.tags.map((tag) => (
              <Link
                key={tag}
                href={`/cookbook?search=${encodeURIComponent(tag)}`}
                className="rounded-full bg-neutral-200 px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                #{tag}
              </Link>
            ))}
          </section>
        ) : null}
      </article>
    </main>
  );
}
