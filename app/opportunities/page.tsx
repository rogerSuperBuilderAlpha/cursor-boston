/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import opportunitiesData from "@/content/opportunities.json";
import { SectionHelp } from "@/components/SectionHelp";
import { OpportunityListings } from "./_components/OpportunityListings";

export const metadata: Metadata = {
  title: "Opportunities",
  description:
    "Jobs, co-founder roles, and equity opportunities from the Cursor Boston community. Find your next venture or hire from our network.",
  alternates: {
    canonical: "https://cursorboston.com/opportunities",
  },
};

const opportunityTypes = [
  {
    name: "Co-Founder",
    description: "Join an early-stage team and build something from the ground up",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    name: "Full-Time",
    description: "Salaried positions at startups and companies in Boston",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    name: "Contract",
    description: "Freelance and project-based work for skilled developers",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    name: "Equity",
    description: "Opportunities offering ownership stakes in early-stage ventures",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
];

export default function OpportunitiesPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Opportunities
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Jobs, co-founder roles, and equity opportunities from the Cursor
            Boston community. Build the future with Boston&apos;s best.
          </p>
        </div>
      </section>

      <div className="px-6 py-6 max-w-4xl mx-auto w-full">
        <SectionHelp
          title="What we list (and don't)"
          intro={
            <>
              Roles, gigs, and co-founder calls from Boston-area members.
              Submissions are reviewed for fit — we keep this focused on
              builders working with AI/Cursor, not generic job postings.
            </>
          }
          faq={[
            {
              q: "How do I post an opportunity?",
              a: "Open a PR adding an entry to content/opportunities.json. Include a clear role, company link, and contact channel.",
            },
            {
              q: "Are these vetted?",
              a: "Maintainers spot-check for spam, scams, and obvious mismatches, but listings are not endorsements. Do your own diligence.",
            },
            {
              q: "What about contract or part-time?",
              a: "Yes — type filters cover full-time, contract, co-founder, and equity. Pick the closest fit when posting.",
            },
          ]}
          links={[
            {
              label: "Adding content (PR guide)",
              href: "https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/develop/docs/ADD_CONTENT.md#add-an-opportunity",
              external: true,
            },
            { label: "Pair programming", href: "/pair" },
          ]}
        />
      </div>

      {/* Contribute CTA */}
      <section className="py-6 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
          <p className="text-neutral-700 dark:text-neutral-300">
            <strong>Know of an opportunity?</strong> Post it by opening a PR that adds an entry to <code className="font-mono text-xs">content/opportunities.json</code>.
          </p>
          <a
            href="https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/develop/docs/ADD_CONTENT.md#add-an-opportunity"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white focus-visible:ring-offset-2"
          >
            How to add an opportunity →
          </a>
        </div>
      </section>

      {/* Opportunity Types */}
      <section className="py-12 px-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-6">
            Opportunity Types
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {opportunityTypes.map((type) => (
              <div
                key={type.name}
                className="flex items-start gap-4 p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800"
              >
                <div className="text-neutral-500 dark:text-neutral-400">{type.icon}</div>
                <div>
                  <h3 className="text-foreground font-medium mb-1">{type.name}</h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">{type.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <OpportunityListings opportunities={opportunitiesData.opportunities} />

      {/* Post Opportunity CTA */}
      <section className="py-16 px-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Have an Opportunity to Share?
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            Looking for a co-founder, hiring for your startup, or have a
            freelance gig? Share it with the Cursor Boston community.
          </p>
          <a
            href="https://discord.gg/Wsncg8YYqc"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Post on Discord (opens in new tab)"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white dark:bg-white dark:text-black rounded-lg text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black"
          >
            Post on Discord
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
              <path d="M7 17l9.2-9.2M17 17V7H7" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}
