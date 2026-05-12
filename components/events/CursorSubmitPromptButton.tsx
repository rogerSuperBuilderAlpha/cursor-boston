/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";

/**
 * Self-contained prompt an attendee can paste into a fresh Cursor chat to
 * have the agent open their submission PR end-to-end. Designed to be
 * unambiguous: tells the agent the destination repo, branch, exact file
 * layout, required + optional `meta.json` fields, and the rules — and
 * forces it to ask the attendee for inputs it can't guess (notebook path,
 * GitHub handle, title, description).
 *
 * Keep in sync with `pydata-2026-submissions/README.md` (which is the
 * source of truth that the maintainer will check the PR against) and with
 * `lib/pydata-submissions.ts` (which validates `meta.json` at build time).
 */
const CURSOR_PROMPT = `I just attended the Cursor Boston × PyData hackathon at Moderna HQ (May 13, 2026). Open a pull request submitting my Jupyter notebook to https://github.com/rogerSuperBuilderAlpha/cursor-boston targeting the \`pydata-2026-submissions\` branch (NOT main or develop).

## Ask me for these — do not guess
- Path to my \`.ipynb\` notebook on this machine
- My GitHub handle (lowercased, exactly as it appears in \`github.com/<handle>\`). You can detect: \`gh api user --jq .login\`
- The name I want displayed on the event page
- A short title (≤120 chars)
- A 1–3 sentence description of what the notebook does

If \`gh\` isn't authenticated (\`gh auth status\` fails), tell me to run \`gh auth login\` and stop until I confirm.

## Files to add to the PR
Exactly two, where \`<handle>\` is my lowercased GitHub handle:

1. \`pydata-2026-submissions/<handle>/submission.ipynb\` — copy from the path I gave you
2. \`pydata-2026-submissions/<handle>/meta.json\`:
\`\`\`json
{
  "title": "...",
  "description": "...",
  "displayName": "..."
}
\`\`\`
You may add \`tags\` (array of lowercase strings, ≤6) or \`collaborators\` (array of \`{ "displayName": "...", "githubHandle": "..." }\`) but only if I tell you to.

## How to open the PR (use \`gh\`)
1. Fork upstream if I don't already have one: \`gh repo fork rogerSuperBuilderAlpha/cursor-boston --clone=false\`.
2. Clone my fork into a scratch dir (e.g. \`/tmp/cb-pydata-<handle>\`), \`cd\` into it, add upstream: \`git remote add upstream https://github.com/rogerSuperBuilderAlpha/cursor-boston && git fetch upstream\`.
3. Branch off the upstream submission branch: \`git checkout -b submit/<handle> upstream/pydata-2026-submissions\`.
4. Add my two files under \`pydata-2026-submissions/<handle>/\`. Commit: \`git add pydata-2026-submissions/<handle>/ && git commit -m "pydata-2026: <handle> submission"\`. Push: \`git push -u origin submit/<handle>\`.
5. Open the PR: \`gh pr create --repo rogerSuperBuilderAlpha/cursor-boston --base pydata-2026-submissions --head <handle>:submit/<handle> --title "pydata-2026: <displayName> — <title>" --body "Notebook submission for the May 13 Cursor Boston × PyData hack at Moderna HQ."\`
6. Print the PR URL and stop.

## Rules (the maintainer will reject the PR if any of these are wrong)
- Folder name **must** be my GitHub handle, lowercased.
- File **must** be named \`submission.ipynb\` exactly.
- \`meta.json\` **must** have \`title\`, \`description\`, \`displayName\`. Other fields are optional.
- Notebook < 50 MB. No Moderna logo or branding anywhere in cells, outputs, or screenshots. No secrets, API keys, or paid datasets.

If anything fails (auth, fork already exists with conflicts, branch already taken, push rejected), tell me what happened and what to do — do not silently bypass.
`;

const COPY_RESET_MS = 2500;

export function CursorSubmitPromptButton() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleCopy = async () => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(CURSOR_PROMPT);
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
              Let Cursor do it for you
            </h3>
          </div>
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            Copy this self-contained prompt, paste it into a fresh Cursor chat,
            and answer its questions about your notebook + title + description.
            The agent forks the repo, creates the right files, and opens the
            PR — you don&apos;t have to read the manual steps below.
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
                Copy Cursor prompt
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
          <code>{CURSOR_PROMPT}</code>
        </pre>
      ) : null}
    </div>
  );
}
