/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";

/**
 * Self-contained prompt an attendee can paste into a fresh Cursor (or
 * Claude Code) chat to have the agent open their Sports Hack 2026 PR
 * end-to-end. Modeled on `CursorSubmitPromptButton` (the PyData
 * equivalent), but the submission shape is different: meta.json only
 * (no notebook file), additional video / repo / deploy URL fields, and
 * the 4 PM ET cutoff is what gates AI-track eligibility.
 *
 * Keep in sync with `sports-hack-2026-submissions/README.md` (the
 * source of truth that the maintainer reviews each PR against).
 */
const SPORTS_HACK_PROMPT = `I just attended the Cursor Boston × Hult Boston Tech Week Sports Hack (May 26, 2026) at Hult International. Open a pull request submitting my project to https://github.com/rogerSuperBuilderAlpha/cursor-boston targeting the \`sports-hack-2026-submissions\` branch (NOT main or develop).

## Hard deadline
4:00 PM ET on Tuesday May 26, 2026 (\`2026-05-26T20:00:00Z\`). The PR must be **opened before** that moment to be eligible for the AI-judged track. After the deadline the PR is still mergeable for the human-judges track, but AI scoring is closed and the public page will flag the card as after-deadline.

## Ask me for these — do not guess
- Project **title** (≤120 chars).
- A **1–3 sentence description** of what I built and what problem it solves (≤500 chars, plain text — markdown is not rendered).
- My **GitHub handle**, lowercased exactly as it appears in \`github.com/<handle>\`. Auto-detect with \`gh api user --jq .login\` and confirm with me.
- The **display name** I want on the public card (defaults to my GitHub handle if I don't have one).
- **Video URL** — Loom, YouTube, or Vimeo. Keep it ≤3 minutes.
- **Public repo URL** for the code (must be a \`https://github.com/...\` URL on a PUBLIC repo).
- **Deployed URL** — a live URL we can open in the browser. If you didn't deploy, pass an empty string \`""\` and explain in the description.
- Optional **tags** (up to 6 short strings, lowercase preferred).
- Optional **collaborators** (up to 10 entries, each with \`displayName\` and optional \`githubHandle\`).

If \`gh\` isn't authenticated (\`gh auth status\` fails), tell me to run \`gh auth login\` and stop until I confirm.

## Before you commit — sanity checks
1. \`title\` non-empty and ≤120 chars; \`description\` ≤500 chars.
2. \`videoUrl\` and \`repoUrl\` start with \`https://\`. \`deployedUrl\` either starts with \`https://\` or is \`""\`.
3. Confirm \`repoUrl\` returns 200 on \`gh api repos/<owner>/<repo>\` (i.e. it's public).
4. Grep the repo for accidentally-committed secrets: \`AKIA\`, \`AIza\`, \`sk-\`, \`BEGIN PRIVATE KEY\`, \`api_key=\`. If any match, STOP and tell me.
5. Run \`python3 -c "import json; json.load(open('meta.json'))"\` after writing meta.json to confirm it parses.

## File to add
Exactly one file, where \`<handle>\` is my lowercased GitHub handle:

\`sports-hack-2026-submissions/<handle>/meta.json\`:

\`\`\`json
{
  "title": "Short, specific project title",
  "description": "1–3 sentences. What did you build? What problem does it solve?",
  "displayName": "Your name as you want it on the page",
  "videoUrl": "https://www.loom.com/share/...",
  "repoUrl": "https://github.com/your-handle/your-project",
  "deployedUrl": "https://your-project.vercel.app",
  "tags": ["nba", "live-stats", "next.js"],
  "collaborators": [
    { "displayName": "Pat Collaborator", "githubHandle": "pat-collab" }
  ]
}
\`\`\`

Omit \`tags\` or \`collaborators\` entirely if I don't have them — don't include empty arrays unless I tell you to.

## How to open the PR (use \`gh\`)
1. Fork upstream if I don't already have one: \`gh repo fork rogerSuperBuilderAlpha/cursor-boston --clone=false\`.
2. Clone my fork into a scratch dir (e.g. \`/tmp/cb-sports-hack-<handle>\`), \`cd\` into it, add upstream: \`git remote add upstream https://github.com/rogerSuperBuilderAlpha/cursor-boston && git fetch upstream\`.
3. Branch off the upstream submission branch: \`git checkout -b submit/<handle> upstream/sports-hack-2026-submissions\`.
4. Add my meta.json under \`sports-hack-2026-submissions/<handle>/\`. Commit (with sign-off): \`git add sports-hack-2026-submissions/<handle>/ && git commit -s -m "sports-hack-2026: <handle> submission"\`. Push: \`git push -u origin submit/<handle>\`.
5. Open the PR: \`gh pr create --repo rogerSuperBuilderAlpha/cursor-boston --base sports-hack-2026-submissions --head <handle>:submit/<handle> --title "sports-hack-2026: <displayName> — <title>" --body "Project submission for the May 26 Cursor Boston × Hult Sports Hack at Hult International."\`
6. Print the PR URL, the current time in ET, and how much time is left before the 4 PM ET cutoff. Stop.

## Rules (the maintainer will reject the PR if any of these are wrong)
- Folder name **must** be my GitHub handle, lowercased exactly.
- The only file in the folder is \`meta.json\`. Do not add screenshots, code, or anything else — submissions are pointers to my own repo + video.
- Required fields (\`title\`, \`description\`, \`videoUrl\`, \`repoUrl\`, \`deployedUrl\`) are all present. \`deployedUrl\` may be an empty string if I didn't deploy, but the field must exist.
- No Moderna, Cursor, Red Bull, or Hult branding misuse in the description or anything reachable from the URLs.
- No secrets or API keys in my project repo (the maintainer will spot-check).

If anything fails — auth, fork already exists, branch already taken, push rejected, validation fails — tell me what happened and what to do. Do not silently bypass.
`;

const COPY_RESET_MS = 2500;

export function SportsHackSubmitPromptButton() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleCopy = async () => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(SPORTS_HACK_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPY_RESET_MS);
    } catch {
      setCopyError(
        "Couldn't write to clipboard — open the preview below and copy manually."
      );
      setPreviewOpen(true);
    }
  };

  return (
    <div className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 dark:bg-emerald-500/10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </span>
            <h3 className="text-base font-semibold text-foreground">
              Let your agent submit for you
            </h3>
          </div>
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            Copy this self-contained prompt and paste it into Cursor, Claude
            Code, or any agent with shell access. It asks you for the title,
            description, video, repo, and deploy URLs, validates them, forks
            this repo, writes <code>meta.json</code> in the right place, and
            opens the PR against <code>sports-hack-2026-submissions</code>{" "}
            before the 4 PM ET cutoff.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
            aria-live="polite"
          >
            {copied ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied
              </>
            ) : (
              <>
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
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy agent prompt
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
            aria-expanded={previewOpen}
          >
            {previewOpen ? "Hide preview" : "Preview prompt"}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={previewOpen ? "rotate-180 transition-transform" : "transition-transform"}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {copyError ? (
        <p className="mt-3 text-xs text-rose-700 dark:text-rose-300" role="alert">
          {copyError}
        </p>
      ) : null}

      {previewOpen ? (
        <pre className="mt-4 max-h-96 overflow-auto rounded-xl border border-emerald-500/20 bg-white p-4 text-xs leading-relaxed text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
          <code>{SPORTS_HACK_PROMPT}</code>
        </pre>
      ) : null}
    </div>
  );
}
