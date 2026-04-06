# Vercel deployments (maintainers)

Contributors work on **`develop`** via PRs; **production** is **`main`**. We only want **production** builds on Vercel when changes land on `main`, not a preview for every PR commit.

## What the repo configures

1. **`vercel.json` → `git.deploymentEnabled`**  
   In Vercel, **any branch not listed used to default to `true`** (deploy on every push). We set:
   - `"*": false` — do not auto-deploy arbitrary branches
   - `"main": true` — only the production branch may trigger deployments from Git  
   See [Git configuration](https://vercel.com/docs/project-configuration/git-configuration).

2. **`ignoreCommand` → `scripts/vercel-ignore-build.sh`**  
   Second line of defense: skip the build unless the deployment is **`VERCEL_ENV=production`** on branch **`main`**. Preview deployments (`VERCEL_ENV=preview`) are canceled even if a job is queued.

3. **GitHub Actions** (this repo) runs on PRs for **lint/test**; that is **not** Vercel. No change to Vercel when you only push a PR.

## Dashboard checklist (recommended)

In the Vercel project **Settings**:

- **Git → Production Branch**: `main`
- **Git**: turn off **Pull Request comments** from the Vercel bot if you do not want comments on every PR (optional; does not affect deploys).
- Confirm **Ignored Build Step** is set to use the command from `vercel.json` (or match behavior: only production on `main`).

## Quotas and canceled builds

Canceled builds from the ignore step may still count toward [deployment limits](https://vercel.com/docs/limits). Keeping `git.deploymentEnabled` correct minimizes queued jobs.

## Restoring preview deploys (optional)

If you later want **preview** URLs for `develop` or PRs, relax `git.deploymentEnabled` and the ignore script together and document the new policy for contributors.
