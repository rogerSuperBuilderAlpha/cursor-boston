/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { CERTIFICATE_PR_THRESHOLD } from "@/lib/certificate";

interface CertificateProgressProps {
  pullRequestsCount: number;
}

export function CertificateProgress({ pullRequestsCount }: CertificateProgressProps) {
  const remaining = CERTIFICATE_PR_THRESHOLD - pullRequestsCount;
  const percentage = Math.min(
    100,
    Math.round((pullRequestsCount / CERTIFICATE_PR_THRESHOLD) * 100)
  );

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <span className="text-lg">🔒</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Certificate Locked</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Merge {remaining} more PR{remaining !== 1 ? "s" : ""} to unlock
          </p>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-neutral-600 dark:text-neutral-400">Progress</span>
          <span className="font-medium text-foreground">
            {pullRequestsCount} / {CERTIFICATE_PR_THRESHOLD} merged PRs
          </span>
        </div>
        <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
        Contribute to the{" "}
        <a
          href="https://github.com/rogerSuperBuilderAlpha/cursor-boston"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          Cursor Boston repository
        </a>{" "}
        and get your pull requests merged to earn your certificate.
      </p>
    </div>
  );
}
