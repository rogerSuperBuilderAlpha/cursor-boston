/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { usePathname } from "next/navigation";
import { GitHubIcon } from "@/components/icons";
import { getEditOnGitHubUrl } from "@/lib/github-edit-link";

/**
 * Renders a "View source on GitHub" link for the current route, pointed at the
 * file a contributor would open in the GitHub editor to propose a change.
 */
export function EditOnGitHubLink({ className }: { className?: string }) {
  const pathname = usePathname() || "/";
  const url = getEditOnGitHubUrl(pathname);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:underline"
      }
    >
      <GitHubIcon size={14} />
      Edit this page on GitHub
    </a>
  );
}
