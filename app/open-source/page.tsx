/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  FileText,
  Heart,
  Network,
  Plus,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DiscordIcon, GitHubIcon } from "@/components/icons";
import { RoadmapExplorer } from "./_components/RoadmapExplorer";

// Treasure hunt clue - The Code Reader:
// Somewhere under lib/ lives the function that gates access to a 2026
// Hack-a-Sprint credit. Find its exported name, translate it to snake_case,
// and submit at /api/hunt/paths/code-reader/submit.
export const metadata: Metadata = {
  title: "Open Source",
  description:
    "Cursor Boston is open source - Explore our roadmap and find ways to contribute.",
};

const STATS = [
  ["GPL-3.0", "License"],
  ["Next.js 16", "Framework"],
  ["TypeScript", "Language"],
  ["Firebase", "Backend"],
] as const;

const STEPS = [
  {
    title: "Fork & Clone",
    description: "Fork the repo and clone it to your local machine.",
  },
  {
    title: "Pick an Idea",
    description: "Choose a roadmap idea or propose your own contribution.",
  },
  {
    title: "Build It",
    description: "Create a branch, write code, and test locally.",
  },
  {
    title: "Submit PR",
    description:
      "Open a pull request against develop (not main) and get feedback from maintainers.",
  },
] as const;

/** Mirrors the routing table in .github/CONTRIBUTING.md (Where to PR). */
const PR_TARGETS = [
  {
    when: "Standard code, bug fix, feature, or docs",
    branch: "develop",
  },
  {
    when: "PyData hackathon notebook",
    branch: "pydata-2026-submissions",
  },
  {
    when: "Hack-a-Sprint showcase project",
    branch: "hack-a-sprint-2026-submissions",
  },
  {
    when: "Summer cohort 1 week N submission",
    branch:
      "c1w1pm-submission / c1w2comms-submission / c1w3mkt-submission / c1w4edu-submission / c1w5startup-submission / c1w6oss-submission",
  },
  {
    when: "Summer cohort 2 vote-format week N submission",
    branch: "c2w1pm-submission / c2w2comms-submission / c2w3mkt-submission",
  },
  {
    when: "Game-mode content (units, artifacts, lore)",
    branch: "game-contributions",
  },
  {
    when: "Maintainer application",
    branch: "maintainer-application",
  },
] as const;

const BENEFITS: readonly {
  title: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  {
    title: "Build Your Portfolio",
    description:
      "Real contributions to a production app that you can show to employers.",
    Icon: ShieldCheck,
  },
  {
    title: "Learn Modern Tech",
    description:
      "Work with Next.js 16, TypeScript, Firebase, Tailwind, and AI-powered workflows.",
    Icon: FileText,
  },
  {
    title: "Join the Community",
    description:
      "Connect with developers who share your focus on AI-powered development.",
    Icon: Users,
  },
  {
    title: "Make an Impact",
    description:
      "Your work helps a real community and serves as a template for others.",
    Icon: Heart,
  },
];

export default function OpenSourcePage() {
  return (
    <div className="flex flex-col">
      <section className="border-b border-neutral-200 px-6 py-16 dark:border-neutral-800 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <Network size={32} aria-hidden="true" />
          </div>
          <h1 className="mb-4 text-4xl font-bold text-neutral-950 dark:text-white md:text-5xl">
            Build With Us
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-neutral-600 dark:text-neutral-400">
            Cursor Boston is fully open source. Explore the roadmap, find a
            focused contribution, and make your mark.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://github.com/rogerSuperBuilderAlpha/cursor-boston"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-200 px-6 py-3 font-semibold text-neutral-950 transition-colors hover:bg-neutral-300 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
            >
              <GitHubIcon size={20} />
              View Repository
            </a>
            <a
              href="#roadmap"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              Explore Roadmap
              <ArrowDown size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-200 bg-neutral-50 px-6 py-8 dark:border-neutral-800 dark:bg-neutral-950/50">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 text-center md:grid-cols-4">
          {STATS.map(([value, label]) => (
            <div key={label}>
              <div className="text-2xl font-bold text-neutral-950 dark:text-white">
                {value}
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <RoadmapExplorer />

      <section className="border-b border-neutral-200 bg-neutral-50 px-6 py-12 dark:border-neutral-800 dark:bg-neutral-950/50 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-3xl font-bold text-neutral-950 dark:text-white">
            How to Contribute
          </h2>

          <ol className="grid list-none gap-6 p-0 md:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="text-center">
                <div
                  className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500 font-bold text-white"
                  aria-hidden="true"
                >
                  {index + 1}
                </div>
                <h3 className="mb-2 font-semibold text-neutral-950 dark:text-white">
                  {step.title}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-10 overflow-x-auto rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="mb-2 text-center text-lg font-semibold text-neutral-950 dark:text-white">
              Where to open your PR
            </h3>
            <p className="mb-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
              Most contributions target{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
                develop
              </code>
              . Change the base branch only for the submission targets below.
              Do not open contributor PRs against{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
                main
              </code>
              .
            </p>
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Pull request base branch for each kind of contribution
              </caption>
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th
                    scope="col"
                    className="pb-2 pr-4 font-semibold text-neutral-950 dark:text-white"
                  >
                    If you&apos;re doing this
                  </th>
                  <th
                    scope="col"
                    className="pb-2 font-semibold text-neutral-950 dark:text-white"
                  >
                    Base branch
                  </th>
                </tr>
              </thead>
              <tbody>
                {PR_TARGETS.map((row) => (
                  <tr
                    key={row.branch}
                    className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                  >
                    <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400">
                      {row.when}
                    </td>
                    <td className="py-2">
                      <code className="break-all text-xs text-emerald-800 dark:text-emerald-300">
                        {row.branch}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
              Full routing notes:{" "}
              <a
                href="https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/develop/docs/SUBMISSION_BRANCHES.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:text-emerald-600 dark:text-emerald-300"
              >
                submission branches
              </a>
              .
            </p>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              href="https://github.com/rogerSuperBuilderAlpha/cursor-boston?tab=contributing-ov-file#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-200 px-5 py-2.5 font-medium text-neutral-950 transition-colors hover:bg-neutral-300 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
            >
              <FileText size={16} aria-hidden="true" />
              Contributing Guide
            </a>
            <a
              href="https://discord.gg/Wsncg8YYqc"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-5 py-2.5 font-medium text-white transition-colors hover:bg-[#4752C4]"
            >
              <DiscordIcon size={16} />
              Join Discord
            </a>
          </div>
        </div>
      </section>

      <section className="px-6 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-3xl font-bold text-neutral-950 dark:text-white">
            Why Contribute?
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            {BENEFITS.map(({ title, description, Icon }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  <Icon size={20} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {title}
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 border-t border-neutral-200 pt-8 dark:border-neutral-800">
            <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
              See also:{" "}
              <Link
                href="/code-of-conduct"
                className="text-emerald-700 hover:text-emerald-600 dark:text-emerald-300"
              >
                Code of Conduct
              </Link>
              {" | "}
              <Link
                href="/terms"
                className="text-emerald-700 hover:text-emerald-600 dark:text-emerald-300"
              >
                Terms of Service
              </Link>
              {" | "}
              <a
                href="https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:text-emerald-600 dark:text-emerald-300"
              >
                GPL-3.0 License
              </a>
            </p>
          </div>

          <div className="mt-8 text-center">
            <a
              href="https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/new?template=feature_request.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-5 py-2.5 font-medium text-neutral-800 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-900"
            >
              <Plus size={16} aria-hidden="true" />
              Propose a Feature
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
