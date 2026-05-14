# Submission branches

Most contributions to Cursor Boston open a PR against **`develop`** — that's the default integration branch and where the vast majority of work lands. See [CONTRIBUTING.md](../.github/CONTRIBUTING.md) for the standard flow.

A handful of contributions go to **dedicated long-lived branches** instead. This page explains what they are, when to use them, and how they stay current.

## What is a submission branch?

A **submission branch** is a long-lived branch in the upstream repo that serves as a **persistent target for a specific kind of contribution** — typically tied to an event, cohort, or contribution program.

Contributors open PRs against the submission branch (not `develop`). Maintainers batch those PRs, merge them into the submission branch, and later promote the branch into `develop` as a single unit. After every `develop → main` release, the maintainers **fast-forward each submission branch back to `develop`** so it stays current and the next contributor's PR diff doesn't fill with stale upstream commits.

You don't need to do anything to keep the branch fresh — that's a maintainer task documented in the project's internal runbook.

## When should you use one?

| If you're doing this… | Open your PR against… |
|---|---|
| Standard code, bug fix, feature work, docs | **`develop`** |
| Submitting a PyData hackathon notebook | **`pydata-2026-submissions`** ([see README](../pydata-2026-submissions/README.md)) |
| Submitting a Hack-a-Sprint showcase project | **`hack-a-sprint-2026-submissions`** ([see README](../content/hackathons/hack-a-sprint-2026/submissions/README.md)) |
| Summer cohort week N submission (PM / comms / marketing / education / startup / oss) | **`c1w1pm-submission`**, **`c1w2comms-submission`**, **`c1w3mkt-submission`**, **`c1w4edu-submission`**, **`c1w5startup-submission`**, or **`c1w6oss-submission`** |
| Game-mode content (units, artifacts, lore, balance tweaks) | **`game-contributions`** |
| Applying to become a maintainer | **`maintainer-application`** (see [GOVERNANCE](../.github/GOVERNANCE.md#becoming-a-maintainer)) |

If you're unsure, default to `develop` and a maintainer will redirect you in review.

## Current submission branches

- `c1w1pm-submission` — summer cohort 1, week 1 (product management)
- `c1w2comms-submission` — week 2 (communications)
- `c1w3mkt-submission` — week 3 (marketing)
- `c1w4edu-submission` — week 4 (education)
- `c1w5startup-submission` — week 5 (startup)
- `c1w6oss-submission` — week 6 (open source)
- `pydata-2026-submissions` — May 13, 2026 PyData × Cursor Boston hack at Moderna HQ
- `hack-a-sprint-2026-submissions` — Hack-a-Sprint 2026 showcase projects
- `game-contributions` — ongoing in-game content (units, artifacts, lore)
- `maintainer-application` — async maintainer applications

## How to PR against a submission branch

The mechanics are the same as a standard PR — only the **base branch** changes:

1. Fork the repo at <https://github.com/rogerSuperBuilderAlpha/cursor-boston>.
2. Create a feature branch on your fork from the submission branch you're targeting (e.g. `pydata-2026-submissions`), not from `develop`.
3. Make your changes, commit with `-s` (DCO sign-off — see [CONTRIBUTING.md](../.github/CONTRIBUTING.md#developer-certificate-of-origin)).
4. Open a PR with **base** = the submission branch in `rogerSuperBuilderAlpha/cursor-boston`.

GitHub defaults the base branch to `develop`, so **change it manually in the PR form** if you're targeting a submission branch.

## What happens after merge

1. Your PR merges into the submission branch.
2. A maintainer batches the submission branch into `develop` (either by opening a tracking PR or by promoting the branch directly, depending on the program).
3. `develop` is later released to `main` on the project's normal release cadence.
4. The submission branch is fast-forwarded back to `develop`'s tip so the next round of contributors starts from a clean base.

For event-specific submissions (PyData, cohort weeks), the merge timing usually aligns with the end of the event or week. Game and maintainer-application submissions are reviewed continuously.

## Why this exists

Three reasons for the extra branch instead of "just PR to `develop`":

1. **Batched review.** Event organizers can review every notebook/submission as a coherent set before promoting.
2. **Clean integration.** Submissions that don't pass review never touch `develop`'s history.
3. **Predictable contributor experience.** A returning attendee in 2027 isn't surprised by a different flow — the pattern stays stable across events.

## For maintainers

The internal fast-forward protocol and the list of branches to sync after each release live in [`CLAUDE.md`](../CLAUDE.md#fast-forward-the-core-contribution-branches-after-every-developmain-release). When a new submission branch is added for a future event/cohort, update both `CLAUDE.md` and this doc.
