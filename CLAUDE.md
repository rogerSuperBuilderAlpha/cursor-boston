# Project instructions for Claude

Conventions and behaviors that apply to every session in this repo.

## Firestore rules + indexes deploy automatically on push to main

`config/firebase/firestore.rules` and `config/firebase/firestore.indexes.json` are deployed by `.github/workflows/firestore-deploy.yml` whenever main moves and either file (or `firebase.json`) changed. **Don't `firebase deploy` these by hand.** If a manual re-deploy is needed (e.g. after editing in the Firebase console and pulling the change down), trigger the `Deploy Firestore rules + indexes` workflow via `workflow_dispatch` instead.

The workflow validates that `firestore.indexes.json` parses before deploying. The Firestore emulator isn't run on every commit — that's a heavyweight check (needs Java) and CI's "Firestore rules tests" job already covers it on every PR.

> **Known issue (May 2026):** every run of the `Deploy Firestore rules + indexes` workflow since 2026-05-12 has failed with `403 Permission denied to get service [firestore.googleapis.com]` — the service account in the `FIREBASE_SERVICE_ACCOUNT_JSON` secret is missing `roles/serviceusage.serviceUsageConsumer` on the `cursor-boston` GCP project. Until that role is granted to the SA, rules/index deploys must be done locally with `firebase deploy --only firestore:rules,firestore:indexes --project cursor-boston` from a maintainer machine. This is the explicit exception to "don't `firebase deploy` by hand."

## Local production verification — emergency typecheck bypass

`next.config.js` honors a `SKIP_TYPECHECK=1` env var that disables both the TypeScript and ESLint build checks. Use it ONLY when pre-existing in-flight branch state has typecheck/lint errors in unrelated files and you need a local build for visual QA. **Never set it in CI.** CI is the boundary that catches type errors; bypassing it locally is fine because you're the boundary.

```bash
SKIP_TYPECHECK=1 npm run build && npm start
```

## Verify locally before any develop→main release

Before merging or pushing any change all the way to `main`, run a local production verification:

1. Run `npm run build`.
2. Run `npm start` against that build.
3. Share the local URL with the user and wait for explicit confirmation before creating or merging the `develop` → `main` release PR.

Do this even when CI or type checks are green, especially for UI changes, so production Vercel deploys are not used as the visual QA loop.

## Fast-forward the core contribution branches after every develop→main release

Several long-lived branches serve as **persistent contribution / submission targets** — contributors PR into them instead of forking against `develop` or `main`. They survive across releases, so they need to stay current with `develop` or contributor PR diffs fill up with stale upstream commits.

> Contributor-facing explanation of these branches lives in [`docs/SUBMISSION_BRANCHES.md`](docs/SUBMISSION_BRANCHES.md). Keep that doc and this section in sync — when a new submission branch is added (next cohort, next event), update both.

Current core branches:

- `c1w1pm-submission`, `c1w2comms-submission`, `c1w3mkt-submission`, `c1w4edu-submission`, `c1w5startup-submission`, `c1w6oss-submission` — summer cohort 1 weekly submissions
- `c2w1pm-submission`, `c2w2comms-submission`, `c2w3mkt-submission` — summer cohort 2 vote-format weekly submissions (create from `origin/develop` before c2 Week 1 kickoff on Mon Jun 29; the dashboard already references these branches via `SUMMER_COHORT_C2_VOTE_WEEKS` in `lib/summer-cohort.ts`)
- `pydata-2026-submissions` — PyData attendee notebooks. **Mirrored at root** as `pydata-2026-submissions/` directory; submissions PR into both the branch and the root directory (the scorer + the event page read from the directory; the branch is the staging surface).
- `hack-a-sprint-2026-submissions` — Hack-a-Sprint showcase JSON submissions
- `game-contributions`

After every `develop → main` release PR merges, fast-forward each one to `origin/develop`'s tip:

```bash
git fetch origin --prune --quiet
DEV=$(git rev-parse origin/develop)
for b in c1w1pm-submission c1w2comms-submission c1w3mkt-submission c1w4edu-submission c1w5startup-submission c1w6oss-submission c2w1pm-submission c2w2comms-submission c2w3mkt-submission game-contributions pydata-2026-submissions hack-a-sprint-2026-submissions; do
 git push origin "${DEV}:refs/heads/${b}"
done
```

Use `origin/develop` (not `origin/main`) — both have the same file tree post-release, but `develop` is linear; pointing at `main` drags release merge commits into the branch's history and pollutes the eventual contributor PR back into `develop`.

Skip a branch if `git log --oneline origin/develop..origin/<branch>` shows commits — that branch has unmerged work and a fast-forward push would silently drop those commits. Resolve the unmerged work first (open a PR to develop, or confirm it's discardable) before syncing.

`maintainer-application` is intentionally excluded — it accumulates application PRs reviewed asynchronously, not bulk-promoted.

When a new core branch is added (next cohort, next event), add it to the list above so the next pass picks it up.

## PyData submission merge checklist

Every PR into `pydata-2026-submissions` is a hackathon entry — it must be scored by the LLM judge before it lands, and the score is what feeds the "Best Submission" ranking and the AI-judge badge on each card on the event page. **Do not merge a PyData submission PR before `score.json` exists in the submission folder.**

For each PR targeting `pydata-2026-submissions`:

1. **Check it out locally.**
   ```bash
   gh pr checkout <pr-number>
   ```
2. **Review for the standard rules** (no Moderna branding, no secrets, folder is the contributor's GitHub handle, `submission.py` + `meta.json` present — reject `.ipynb` submissions, the format is Marimo's native `.py`). See `pydata-2026-submissions/README.md`.
3. **Run the LLM scorer.** This calls Claude with the hackathon rubric and writes `score.json` (score 1-10 + rationale + model + scoredAt) into the submission folder:
   ```bash
   ANTHROPIC_API_KEY=... npx tsx scripts/score-pydata-submission.ts --handle <gh-handle>
   ```
   Re-score with `--force` only if the contributor pushed new commits after the first score. The rubric and "competition datasets" list are defined inline in the script; update them there when the event rules change.
4. **Commit `score.json` onto the PR branch** (DCO sign-off required like any other commit):
   ```bash
   git add pydata-2026-submissions/<gh-handle>/score.json
   git commit -s -m "judge(pydata-2026): score <gh-handle> submission"
   git push
   ```
   The score lives with the submission so the event page can render the AI-judge badge and so the ranking is auditable in the merge commit.
5. **Merge the PR** into `pydata-2026-submissions` (squash is fine — the score commit is small and self-contained).
6. **Bulk-promote** the submission branch into `develop` per the normal flow when batching is done.

Notes:
- `score.json` is **maintainer-authored**, not contributor-authored. Reject any PR that includes a `score.json` written by the contributor — they don't get to score themselves.
- If `ANTHROPIC_API_KEY` isn't available locally, you can run the scorer against the merged folder later, but score every submission before announcing winners — the "Best Submission" prize is decided from these scores.
- A PyData submission without `score.json` will still render on the event page (the badge just won't appear), but it is **ineligible for "Best Submission"** until scored.
