/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

const REPO_BASE = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";
const DEFAULT_BRANCH = "develop";

/**
 * Routes whose source file doesn't follow the `app/<route>/page.tsx` convention
 * — e.g. group routes, dynamic segments, or pages that render from content files.
 */
const ROUTE_OVERRIDES: Record<string, string> = {
  "/": "app/page.tsx",
  "/login": "app/(auth)/login/page.tsx",
  "/signup": "app/(auth)/signup/page.tsx",
  "/profile": "app/(auth)/profile/page.tsx",
};

/**
 * Maps a runtime pathname to the source file a contributor would edit on GitHub.
 * Falls back to the nearest containing page.tsx for dynamic segments.
 */
export function getEditOnGitHubUrl(
  pathname: string,
  branch: string = DEFAULT_BRANCH
): string {
  const clean = pathname.split("?")[0]!.split("#")[0]!.replace(/\/+$/, "") || "/";

  const override = ROUTE_OVERRIDES[clean];
  if (override) return `${REPO_BASE}/edit/${branch}/${override}`;

  // Strip dynamic segments (anything after a literal slug that looks non-static
  // is too specific to link to — walk up to the closest real page).
  const parts = clean.split("/").filter(Boolean);
  const filePath = parts.length === 0
    ? "app/page.tsx"
    : `app/${parts.join("/")}/page.tsx`;

  return `${REPO_BASE}/edit/${branch}/${filePath}`;
}

/** Link to browse the repo (for a plain "View on GitHub" link). */
export function getRepoUrl(): string {
  return REPO_BASE;
}

/** Link to open a new issue with an optional title/body. */
export function getNewIssueUrl(params?: { title?: string; body?: string; labels?: string[] }): string {
  const u = new URL(`${REPO_BASE}/issues/new`);
  if (params?.title) u.searchParams.set("title", params.title);
  if (params?.body) u.searchParams.set("body", params.body);
  if (params?.labels?.length) u.searchParams.set("labels", params.labels.join(","));
  return u.toString();
}
