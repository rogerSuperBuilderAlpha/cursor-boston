# Branch protection

This page documents the **required protections** on `main` and `develop`, the **status checks** that gate merges, and the **one admin-bypass case** that's deliberately allowed. It exists so that contributors and future maintainers can verify GitHub's branch-protection settings against the project's stated policy.

The live settings are visible to anyone with admin access via:

```bash
gh api repos/rogerSuperBuilderAlpha/cursor-boston/branches/main/protection
gh api repos/rogerSuperBuilderAlpha/cursor-boston/branches/develop/protection
```

If the live settings drift from this document, treat the document as the source of truth and reconcile via the GitHub UI (Settings → Branches), then update this file if the intended policy actually changed.

---

## `main` — production branch

`main` tracks production. Vercel deploys from `main` only. Everything that lands here was already reviewed on `develop`.

**Required protections:**

- **Require a pull request before merging.** No direct pushes. Release PRs from `develop` are the only mechanism.
- **Require status checks to pass before merging:**
  - `CI / lint-and-typecheck`
  - `CI / test` (Jest)
  - `CI / firestore-rules-tests`
  - `CI / e2e` (Playwright smoke)
  - `CI / build`
  - `CI / security` (npm audit, license allowlist, gitleaks, SBOM)
  - `DCO`
- **Require branches to be up to date before merging.** Release PRs must be rebased onto the latest `main`.
- **Require signed-off commits.** Enforced via the `DCO` check on every commit in the PR.
- **No force pushes.** Disabled.
- **No deletions.** Disabled.
- **Restrict who can push.** Only maintainers (currently `@rogerSuperBuilderAlpha`).

**Admin-bypass case:**

The Project Lead may use `gh pr merge --admin` on a develop→main release PR when GitHub reports `mergeStateStatus=BEHIND` despite `develop` being topologically ahead, or when DCO sign-off mismatches block an already-reviewed release. **This bypass is documented for release PRs only** — never for feature PRs. See [`docs/RELEASING.md`](RELEASING.md) for the full release flow.

**Emergency-only protection disable:**

The April 2026 referral-code postmortem ([`docs/security-incident-2026-04-11.md`](security-incident-2026-04-11.md)) documents the only case where `main`'s protection was disabled — to force-push a history rewrite after `git filter-repo` scrubbed a leaked file. Protection was re-enabled immediately after. Any future disable must follow the same shape: time-boxed, documented in the postmortem, and re-enabled before any normal PR activity resumes.

---

## `develop` — integration branch

`develop` is the default branch on GitHub. Most PRs land here.

**Required protections:**

- **Require a pull request before merging.** No direct pushes.
- **Require status checks to pass before merging:**
  - `CI / lint-and-typecheck`
  - `CI / test`
  - `CI / firestore-rules-tests`
  - `CI / e2e`
  - `CI / build`
  - `CI / security`
  - `DCO`
- **Require branches to be up to date before merging.** Feature branches must rebase onto the latest `develop`.
- **Require signed-off commits.** Enforced via DCO.
- **No force pushes.** Disabled.
- **No deletions.** Disabled.

`develop` does **not** restrict push permissions beyond the "requires PR" rule — maintainers merge approved PRs but do not push branches directly.

---

## Submission branches (`c1w*-submission`, `pydata-2026-submissions`, `game-contributions`, `maintainer-application`)

Submission branches are **not** under the same strict protection as `main` / `develop`, because they accept contributor PRs from outside the maintainer team and are fast-forwarded back to `develop` after each release. See [`docs/SUBMISSION_BRANCHES.md`](SUBMISSION_BRANCHES.md) for the model.

Minimum protections (all submission branches):

- **Require a pull request before merging.**
- **Require DCO sign-off** on every commit.
- **No force pushes** by contributors (maintainers fast-forward to `origin/develop` after releases — that's the only allowed non-merge update).
- **No deletions** — these branches persist across releases.

Status checks are **not required** on submission branches: CI runs but doesn't gate merges, because the branches accumulate contributor work that gets batch-integrated into `develop`, where the full CI gate is enforced.

---

## How to verify current settings

```bash
# Inspect main's protection
gh api repos/rogerSuperBuilderAlpha/cursor-boston/branches/main/protection \
  | jq '{checks: .required_status_checks.contexts, require_pr: .required_pull_request_reviews != null, dco: any(.required_status_checks.contexts[]; . == "DCO"), force_push: .allow_force_pushes.enabled, deletions: .allow_deletions.enabled}'

# Inspect develop's protection
gh api repos/rogerSuperBuilderAlpha/cursor-boston/branches/develop/protection \
  | jq '{checks: .required_status_checks.contexts, require_pr: .required_pull_request_reviews != null}'
```

If a status-check name in the live settings doesn't match the names listed above (e.g., a CI job was renamed), update both the workflow and this document so the policy and the enforcement stay aligned.

---

## Related docs

- [`docs/RELEASING.md`](RELEASING.md) — release flow, including admin-bypass usage on release PRs
- [`docs/SECURITY_OPERATIONS.md`](SECURITY_OPERATIONS.md) — rotation cadence, incident response
- [`docs/SUBMISSION_BRANCHES.md`](SUBMISSION_BRANCHES.md) — submission-branch model
- [`.github/CONTRIBUTING.md`](../.github/CONTRIBUTING.md) — fork workflow and DCO
