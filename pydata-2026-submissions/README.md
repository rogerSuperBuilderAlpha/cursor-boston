# PyData × Cursor Boston — Hackathon submissions

This directory holds the Marimo notebook submissions from the **May 13, 2026
Cursor Boston × PyData evening hack at Moderna HQ**. The event is over, but
the exercise stays open: anyone can complete it later and open a PR to have
their work listed on the public showcase. Marimo saves notebooks as plain
Python files (`.py`), so every submission is a `submission.py`.

Each subfolder is one attendee's submission. The public showcase page at
[cursorboston.com/events/cursor-boston-pydata-2026](https://cursorboston.com/events/cursor-boston-pydata-2026)
reads this directory at build time and renders a card per merged submission.

---

## How to submit your work

1. **Fork the repo** at
   <https://github.com/rogerSuperBuilderAlpha/cursor-boston>.

2. **Create a folder under `pydata-2026-submissions/`** named after your
   GitHub handle (lowercase, exactly as it appears in `github.com/<handle>`).
   Example: `pydata-2026-submissions/adam-sychla/`.

3. **Add two files inside your folder:**
   - `submission.py` — your Marimo notebook, in Marimo's native `.py` format
     (the file Marimo writes when you save). GitHub renders it as Python
     source; reviewers can run it locally with `marimo run submission.py`.
     Do **not** submit a `.ipynb` — submissions must be `.py`.
   - `meta.json` — title + description, see template below.

4. **Open a PR** targeting the branch **`pydata-2026-submissions`** (not
   `develop` or `main`). We'll batch all the PRs into that branch, merge it
   into `develop`, then promote `develop` to `main` — your card appears on
   the gated event page after the final push to `main` deploys.

5. **One folder per attendee.** If you collaborated, pick one handle for the
   folder name and list collaborators inside `meta.json` (see below).

---

## `meta.json` template

```json
{
  "title": "Short, specific title for your notebook",
  "description": "1–3 sentences. What does the notebook do? What dataset or problem? What did you find?",
  "displayName": "Your name as you want it on the page",
  "tags": ["healthcare", "embeddings", "exploratory"],
  "collaborators": [
    { "displayName": "Pat Collaborator", "githubHandle": "pat-collab" }
  ]
}
```

### Field reference

| Field | Required | Notes |
|---|---|---|
| `title` | yes | ≤120 chars. Shown as the card heading. |
| `description` | yes | ≤500 chars. One paragraph. Markdown not rendered — plain text only. |
| `displayName` | yes | Falls back to your GitHub handle if omitted, but please set it. |
| `tags` | no | ≤6 short tags. Lowercase. Shown as pills. |
| `collaborators` | no | List of `{ displayName, githubHandle }` for people who worked with you. The page lists them under your card. |

### Rules

- Don't include any **Moderna logo, branding, or photos** in your notebook
  output cells or in `meta.json`. Moderna asked us to keep those off public
  surfaces.
- Don't commit secrets, API keys, or paid data. Sample data only.
- Keep `submission.py` under **50 MB** — if you have a huge dataset,
  reference it by URL inside the notebook instead of embedding.
- Your folder name is your **GitHub handle**, not your real name. The page
  shows your `displayName` from `meta.json`.

---

## What happens after you open the PR

1. A maintainer reviews the PR for the rules above (no branding leak, no
   secrets, file structure correct).
2. **The maintainer runs the LLM judge** against your notebook and commits
   a `score.json` (score 1-10 + rationale + model) into your folder. This
   is the "black box" judge that decides the **Best Submission** winners.
   You don't add `score.json` yourself — any PR that ships one will be
   rejected.
3. PR gets merged into the `pydata-2026-submissions` branch.
4. When the maintainer is ready (likely batched, end-of-night or next
   morning), `pydata-2026-submissions` is merged into `develop`, then
   `develop` into `main`. Vercel deploys main → your card (with score
   badge) goes live.
5. Your submission shows up on the event page. Other attendees can browse
   it; the card links to `submission.py` on GitHub, which renders the
   Marimo notebook source as Python.

If anything's off, the maintainer will leave PR comments and you can push
fixes to the same branch. If you push new commits after a score lands, the
maintainer will re-score before merging.
