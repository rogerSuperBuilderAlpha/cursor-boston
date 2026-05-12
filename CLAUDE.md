# Project instructions for Claude

Conventions and behaviors that apply to every session in this repo.

## Firestore rules + indexes deploy automatically on push to main

`config/firebase/firestore.rules` and `config/firebase/firestore.indexes.json` are deployed by `.github/workflows/firestore-deploy.yml` whenever main moves and either file (or `firebase.json`) changed. **Don't `firebase deploy` these by hand.** If a manual re-deploy is needed (e.g. after editing in the Firebase console and pulling the change down), trigger the `Deploy Firestore rules + indexes` workflow via `workflow_dispatch` instead.

The workflow validates that `firestore.indexes.json` parses before deploying. The Firestore emulator isn't run on every commit — that's a heavyweight check (needs Java) and CI's "Firestore rules tests" job already covers it on every PR.

## Fast-forward the core contribution branches after every develop→main release

Several long-lived branches serve as **persistent contribution / submission targets** — contributors PR into them instead of forking against `develop` or `main`. They survive across releases, so they need to stay current with `develop` or contributor PR diffs fill up with stale upstream commits.

Current core branches:

- `c1w1pm-submission`, `c1w2comms-submission`, `c1w3mkt-submission`, `c1w4edu-submission`, `c1w5startup-submission`, `c1w6oss-submission` — summer cohort 1 weekly submissions
- `pydata-2026-submissions` — PyData attendee notebooks
- `game-contributions`

After every `develop → main` release PR merges, fast-forward each one to `origin/develop`'s tip:

```bash
git fetch origin --prune --quiet
DEV=$(git rev-parse origin/develop)
for b in c1w1pm-submission c1w2comms-submission c1w3mkt-submission c1w4edu-submission c1w5startup-submission c1w6oss-submission game-contributions pydata-2026-submissions; do
  git push origin "${DEV}:refs/heads/${b}"
done
```

Use `origin/develop` (not `origin/main`) — both have the same file tree post-release, but `develop` is linear; pointing at `main` drags release merge commits into the branch's history and pollutes the eventual contributor PR back into `develop`.

Skip a branch if `git log --oneline origin/develop..origin/<branch>` shows commits — that branch has unmerged work and a fast-forward push would silently drop those commits. Resolve the unmerged work first (open a PR to develop, or confirm it's discardable) before syncing.

`maintainer-application` is intentionally excluded — it accumulates application PRs reviewed asynchronously, not bulk-promoted.

When a new core branch is added (next cohort, next event), add it to the list above so the next pass picks it up.
