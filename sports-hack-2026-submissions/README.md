# Boston Tech Week Sports Hack — submissions

This directory holds project submissions for the **May 26, 2026 Cursor Boston ×
Hult Sports Hack** at Hult International (Cambridge). The event runs **10 AM –
4 PM ET** with a hard submission deadline at **4:00 PM ET sharp** (event end).

Each subfolder is one attendee's submission. The public showcase page at
[cursorboston.com/events/cursor-boston-sports-hack-2026](https://cursorboston.com/events/cursor-boston-sports-hack-2026)
reads this directory at build time and renders a card per merged submission.

---

## How to submit your project

1. **Fork the repo** at
   <https://github.com/rogerSuperBuilderAlpha/cursor-boston>.

2. **Create a folder under `sports-hack-2026-submissions/`** named after your
   GitHub handle (lowercase, exactly as it appears in `github.com/<handle>`).
   Example: `sports-hack-2026-submissions/jane-doe/`.

3. **Add `meta.json` inside your folder** describing the project — see the
   template below. That's the only required file.

4. **Open a PR** targeting the branch **`sports-hack-2026-submissions`** (not
   `develop` or `main`). We'll batch all PRs into that branch, merge it into
   `develop`, then promote `develop` to `main` — your card appears on the
   public event page after the final push to `main` deploys.

5. **One folder per attendee.** If you collaborated, pick one handle for the
   folder name and list collaborators inside `meta.json`.

## First-time GitHub PR checklist

If this is your first pull request, use this shortest path after you fork the
repo:

```bash
git clone https://github.com/YOUR-GITHUB-HANDLE/cursor-boston.git
cd cursor-boston
git remote add upstream https://github.com/rogerSuperBuilderAlpha/cursor-boston.git
git fetch upstream
git checkout -b sports-hack/YOUR-GITHUB-HANDLE upstream/sports-hack-2026-submissions
mkdir -p sports-hack-2026-submissions/YOUR-GITHUB-HANDLE
```

Then add `sports-hack-2026-submissions/YOUR-GITHUB-HANDLE/meta.json`, commit
with sign-off, and push the branch:

```bash
git add sports-hack-2026-submissions/YOUR-GITHUB-HANDLE/meta.json
git commit -s -m "docs(sports-hack): submit YOUR-GITHUB-HANDLE project"
git push origin sports-hack/YOUR-GITHUB-HANDLE
```

On GitHub, open the pull request with:

- **base repository**: `rogerSuperBuilderAlpha/cursor-boston`
- **base branch**: `sports-hack-2026-submissions`
- **head repository**: `YOUR-GITHUB-HANDLE/cursor-boston`
- **compare branch**: `sports-hack/YOUR-GITHUB-HANDLE`

Before submitting, double-check that the PR only adds your folder under
`sports-hack-2026-submissions/` and that `meta.json` does not contain API keys,
tokens, or private credentials.

---

## Deadlines + scoring

- **Hard deadline: 4:00 PM ET on Tuesday, May 26 (2026-05-26T20:00:00Z).**
  Your PR must be **opened before** this moment to be eligible for AI scoring.
- **One second late and your AI eval is gone.** You can still be reviewed by
  the human judges and win a judge-track prize — but the AI track is closed.
- **Winners**: 3 from the AI track + 3 from the judges track = 6 total.

---

## `meta.json` template

```json
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
```

### Field reference

| Field | Required | Notes |
|---|---|---|
| `title` | yes | ≤120 chars. Shown as the card heading. |
| `description` | yes | ≤500 chars. Plain text — markdown not rendered. |
| `displayName` | recommended | Falls back to your GitHub handle if absent. |
| `videoUrl` | yes | Loom, YouTube, Vimeo — any URL we can watch from. Keep it ≤3 minutes. |
| `repoUrl` | yes | Public GitHub URL for the code. |
| `deployedUrl` | yes | A live URL we can open in a browser. If you didn't deploy, leave as `""` and put a note in the description. |
| `tags` | optional | Up to 6 short tags. |
| `collaborators` | optional | Up to 10. Each has `displayName` + optional `githubHandle`. |

---

## What happens after you submit

1. A maintainer reviews your PR for the basics (folder name matches handle,
   `meta.json` parses, no secrets, no Hult/Cursor logos misused).
2. PRs are batched into `develop` and promoted to `main` — your card goes live
   on the public submissions page.
3. After the 4:00 PM ET deadline, a maintainer runs the AI judge over every
   eligible submission. The score lands as `score.json` in your folder; a card
   badge reflects it.
4. Human judges review every submission (AI-eligible or not) in parallel.
5. Winners are announced on-stage shortly after.

---

## Common rejections

- Folder name doesn't match the GitHub handle on the PR.
- `meta.json` doesn't parse, or required fields are missing.
- Secrets or API keys committed to the repo.
- Branding misuse (Hult, Cursor, Moderna logos used where they shouldn't be).
- PR opened after 4:00 PM ET → still mergeable for the judges track, but
  flagged as after-deadline on the public page (no AI eval).
