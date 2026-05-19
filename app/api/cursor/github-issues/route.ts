/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { cursorContract } from "@/lib/api-schemas/cursor";
import { rateLimitConfigs, withMiddleware } from "@/lib/middleware";
import { getVerifiedUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

void cursorContract.listGithubIssues;

const DEFAULT_OWNER = "rogerSuperBuilderAlpha";
const DEFAULT_REPO = "cursor-boston";

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  comments: number;
  updated_at: string;
  labels: Array<string | { name?: string }>;
  pull_request?: unknown;
}

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const user = await getVerifiedUser(request);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const owner = process.env.GITHUB_REPO_OWNER || DEFAULT_OWNER;
  const repo = process.env.GITHUB_REPO_NAME || DEFAULT_REPO;
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);
  url.searchParams.set("state", "open");
  url.searchParams.set("per_page", "30");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");

  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "cursor-boston-pr-studio",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, {
    headers,
    next: { revalidate: 60 },
  });
  if (!response.ok) {
    return NextResponse.json({ error: "github_issues_failed" }, { status: 500 });
  }

  const payload = (await response.json()) as GitHubIssue[];
  const issues = payload
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      labels: issue.labels
        .map((label) => (typeof label === "string" ? label : label.name ?? ""))
        .filter(Boolean),
      body: issue.body ? issue.body.slice(0, 4000) : null,
      comments: issue.comments,
      updatedAt: issue.updated_at,
    }));

  return NextResponse.json({ ok: true, issues });
}

export const GET = withMiddleware(rateLimitConfigs.standard, handleGet);
