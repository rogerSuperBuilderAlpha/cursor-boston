/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import Link from "next/link";
import { getGithubRepoWebBaseUrl } from "@/lib/github-recent-merged-prs";
import {
  MAINTAINER_APPLICATION_BRANCH,
  getMaintainerApplicationBranchTreeUrl,
} from "@/lib/maintainer-application";

const panelClass =
  "rounded-xl border border-neutral-800 bg-neutral-950/60 p-6 md:p-8 hover:border-neutral-700 transition-colors";

export default function MaintainersPage() {
  const repoBase = getGithubRepoWebBaseUrl();
  const branchTreeUrl = getMaintainerApplicationBranchTreeUrl();

  return (
    <div className="flex flex-col">
      <section className="py-14 md:py-20 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-violet-500/10 rounded-2xl mb-5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-violet-400"
              aria-hidden
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Maintainers</h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            Maintainers steward the Cursor Boston open source project: reviews, CI, releases, and welcoming
            contributors. If you want to help lead, start with an application. Everyone else can still
            contribute through issues and pull requests on <code className="text-violet-300">develop</code>.
          </p>
        </div>
      </section>

      <section className="py-10 md:py-14 px-6">
        <div className="max-w-3xl mx-auto grid gap-6 md:grid-cols-1">
          <Link href="/maintainers/apply" className={`${panelClass} block group`}>
            <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-violet-300 transition-colors">
              Apply to be a maintainer
            </h2>
            <p className="text-neutral-400 text-sm md:text-base mb-3">
              Connect GitHub and Discord on your site profile, then open a pull request with a short JSON
              application to the <code className="text-violet-300">{MAINTAINER_APPLICATION_BRANCH}</code>{" "}
              branch.
            </p>
            <span className="text-emerald-400 text-sm font-medium">Go to application steps →</span>
          </Link>

          <Link href="/maintainers/dashboard" className={`${panelClass} block group`}>
            <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-violet-300 transition-colors">
              Maintainer dashboard
            </h2>
            <p className="text-neutral-400 text-sm md:text-base mb-3">
              After your application PR is open, use the dashboard for the weekly Zoom and your review queue.
              If you are not eligible yet, you will be sent back to the application steps.
            </p>
            <span className="text-emerald-400 text-sm font-medium">Open dashboard →</span>
          </Link>

          <div className="grid sm:grid-cols-2 gap-4">
            <a
              href={repoBase}
              target="_blank"
              rel="noopener noreferrer"
              className={panelClass}
            >
              <h2 className="text-base font-semibold text-white mb-2">Repository</h2>
              <p className="text-neutral-400 text-sm mb-2">
                Issues, pull requests, and contributor discussion on GitHub.
              </p>
              <span className="text-emerald-400 text-sm font-medium">Open on GitHub →</span>
            </a>
            <a
              href={branchTreeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={panelClass}
            >
              <h2 className="text-base font-semibold text-white mb-2">Application branch</h2>
              <p className="text-neutral-400 text-sm mb-2">
                Maintainer applications merge into <code className="text-violet-300">{MAINTAINER_APPLICATION_BRANCH}</code>.
              </p>
              <span className="text-emerald-400 text-sm font-medium">View branch on GitHub →</span>
            </a>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-6 md:p-8">
            <h2 className="text-base font-semibold text-white mb-3">Community norms</h2>
            <p className="text-neutral-400 text-sm mb-4">
              Maintainers are expected to uphold our standards and help others do the same.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/code-of-conduct"
                className="text-emerald-400 text-sm font-medium hover:underline"
              >
                Code of Conduct
              </Link>
              <Link href="/open-source" className="text-emerald-400 text-sm font-medium hover:underline">
                Open source & roadmap
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
