/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import talksData from "@/content/talks.json";
import articlesData from "@/content/articles.json";
import { NeedsWorkBanner } from "@/components/NeedsWorkBanner";
import { SectionHelp } from "@/components/SectionHelp";

export const metadata: Metadata = {
  title: "Talks",
  description:
    "Archive of talks and presentations from Cursor Boston events. Plus curated AI research articles from Boston-area universities.",
};

export default function TalksPage() {
  return (
    <div className="flex flex-col">
      <div className="max-w-6xl mx-auto w-full px-6 pt-4">
        <NeedsWorkBanner
          area="Talks"
          description="Talks archive is mostly empty. Help by submitting recordings, backfilling past meetup talks, or improving the archive UX and filters."
        />
      </div>
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Talks
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Archive of presentations from our community events. Learn how others
            are using Cursor in their workflows.
          </p>
        </div>
      </section>

      <div className="px-6 py-6 max-w-4xl mx-auto w-full">
        <SectionHelp
          title="Submitting a talk"
          intro={
            <>
              Anyone can pitch a talk. Sessions are typically 10–20 min and
              cover prompting patterns, agentic workflows, codebases built
              with Cursor, or process / craft. Submit a proposal below and
              we&apos;ll get back to you before the next event slot opens.
            </>
          }
          faq={[
            {
              q: "What format should I submit?",
              a: "A short title, a one-paragraph abstract, and your preferred format (lightning, full talk, demo, panel). If you have a draft deck or repo, link it.",
            },
            {
              q: "When do I find out if it's accepted?",
              a: "We batch reviews against the upcoming event calendar — usually a week-to-two-week turnaround. Acceptance is async over email or Discord.",
            },
            {
              q: "Are talks recorded?",
              a: "Recording is opt-in. If you want your talk recorded and posted to the archive, say so in the submission; we'll handle capture at the event and the post-event upload.",
            },
          ]}
          links={[
            { label: "Submit a talk proposal", href: "/talks/submit" },
            {
              label: "Discord — pitch ideas in #talks",
              href: "https://discord.gg/Wsncg8YYqc",
              external: true,
            },
          ]}
        />
      </div>

      {/* Categories */}
      <section className="py-12 px-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-6">
            Talk Categories
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {talksData.categories.map((category) => (
              <div
                key={category.id}
                className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800"
              >
                <h3 className="text-foreground font-medium mb-2">{category.name}</h3>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                  {category.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Talks List */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">
            Featured Talks
          </h2>

          {talksData.talks.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {talksData.talks.map((talk: {
                id: string;
                title: string;
                speaker: string;
                date: string;
                description: string;
                category: string;
                videoUrl?: string;
              }) => (
                <div
                  key={talk.id}
                  className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                >
                  <div className="p-6">
                    <span className="inline-block px-2 py-1 bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 text-xs font-medium rounded mb-3 capitalize">
                      {talk.category}
                    </span>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {talk.title}
                    </h3>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-3">
                      by {talk.speaker}
                    </p>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed mb-4">
                      {talk.description}
                    </p>
                    {talk.videoUrl && (
                      <a
                        href={talk.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-foreground text-sm font-medium hover:underline focus-visible:outline-none focus-visible:underline"
                      >
                        Watch Recording
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl p-12 text-center border border-neutral-200 dark:border-neutral-800">
              <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-500 dark:text-neutral-400"
                  aria-hidden="true"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Coming Soon
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                Talks from our events will be added here after our first meetup.
                Check back soon!
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Featured Articles */}
      <section className="py-16 px-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Featured Articles
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-8">
            Key AI research from Boston-area universities
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articlesData.articles.map((article: {
              id: string;
              title: string;
              source: string;
              url: string;
              date: string;
              description: string;
            }) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors block"
              >
                <div className="p-6">
                  <span className="inline-block px-2 py-1 bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 text-xs font-medium rounded mb-3">
                    {article.source}
                  </span>
                  <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:underline">
                    {article.title}
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed mb-4">
                    {article.description}
                  </p>
                  <span className="inline-flex items-center gap-2 text-foreground text-sm font-medium">
                    Read Article
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Submit Talk CTA */}
      <section className="py-16 px-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Share Your Ideas
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-2">
            We&apos;re always looking for speakers to share their experiences
            with Cursor and AI-powered development.
          </p>
          <p className="text-neutral-600 dark:text-neutral-400 mb-8">
            <strong className="text-foreground">All skill levels are welcome</strong>{" "}
            &ndash; whether you&apos;re a seasoned developer, a designer
            exploring AI tools, a student learning to code, or from any other
            discipline using Cursor in creative ways.
          </p>
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 mb-8">
            <h3 className="text-foreground font-medium mb-3">Talk ideas include:</h3>
            <ul className="text-neutral-600 dark:text-neutral-400 text-sm space-y-2">
              <li>A workflow or technique you&apos;ve discovered</li>
              <li>A project you built with Cursor</li>
              <li>Tips for using Cursor in a specific domain</li>
              <li>Lessons learned from AI-assisted development</li>
              <li>Live coding demos and tutorials</li>
            </ul>
          </div>
          <a
            href="/talks/submit"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white dark:bg-white dark:text-black rounded-lg text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950"
          >
            Submit Your Talk Idea
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}
