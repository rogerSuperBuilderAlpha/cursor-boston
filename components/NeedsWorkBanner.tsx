/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Construction } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { getEditOnGitHubUrl, getNewIssueUrl, getRepoUrl } from "@/lib/github-edit-link";

/**
 * Renders an amber banner signaling that the current page is open for
 * contributor improvements. Shows up-front on pages listed under the
 * "Needs Work" nav group.
 */
export function NeedsWorkBanner({
  area,
  description,
}: {
  /** Short label for the issue title, e.g. "Analytics", "Pair Programming". */
  area: string;
  /** Optional sentence describing what specifically could be improved. */
  description?: string;
}) {
  const pathname = usePathname() || "/";
  const editUrl = getEditOnGitHubUrl(pathname);
  const issueUrl = getNewIssueUrl({
    title: `[${area}] improvement proposal`,
    labels: ["enhancement", "good first issue"],
  });
  const roadmapUrl = "/open-source";

  useEffect(() => {
    void trackEvent("feature_banner_view", {
      area,
      path: pathname,
    });
  }, [area, pathname]);

  const trackCta = (cta: string) => {
    void trackEvent("feature_banner_cta_click", {
      area,
      path: pathname,
      cta,
    });
  };

  return (
    <div
      role="note"
      className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500 px-5 py-4 mb-6 rounded-r-md"
    >
      <div className="flex items-start gap-3">
        <Construction className="h-5 w-5 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            This page needs work — contributors welcome
          </p>
          {description ? (
            <p className="text-sm text-amber-800 dark:text-amber-300/90 mt-1">
              {description}
            </p>
          ) : null}
          <p className="text-sm text-amber-800 dark:text-amber-300/90 mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <a
              className="underline hover:no-underline"
              href={roadmapUrl}
              onClick={() => trackCta("open_source_roadmap")}
            >
              Open-source roadmap
            </a>
            <a
              className="underline hover:no-underline"
              href={editUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCta("edit_github")}
            >
              Edit this page on GitHub
            </a>
            <a
              className="underline hover:no-underline"
              href={issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCta("open_issue")}
            >
              Open an issue
            </a>
            <a
              className="underline hover:no-underline"
              href={getRepoUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCta("browse_repo")}
            >
              Browse the repo
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
