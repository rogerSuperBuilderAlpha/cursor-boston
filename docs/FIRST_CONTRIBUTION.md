# Your First Contribution

A step-by-step guide to making your first pull request. Time estimate: 30-45 minutes (including setup).

> **Prerequisites:** Complete the [Development Guide](DEVELOPMENT.md) setup first and verify the [Onboarding Checklist](DEVELOPMENT.md#onboarding-checklist) passes.

---

## Step 1: Find an Issue

Browse open issues and pick one tagged `good first issue`:

**[View good first issues](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)**

Comment on the issue to let others know you're working on it:

> "I'd like to work on this!"

If an issue is already claimed, pick another one or ask in [Discord](https://discord.gg/Wsncg8YYqc) for suggestions.

---

## Step 2: Set Up Your Branch

Make sure your fork's `develop` branch is up to date, then create a feature branch:

```bash
# If you haven't added upstream yet:
git remote add upstream https://github.com/rogerSuperBuilderAlpha/cursor-boston.git

# Update and branch
git checkout develop
git pull upstream develop
git checkout -b docs/fix-typo-in-readme    # use type/short-description
```

**Branch naming convention:** `type/short-description`
- `feat/add-voting` for features
- `fix/auth-redirect` for bug fixes
- `docs/update-api-reference` for documentation

---

## Step 3: Make Your Change

For a first PR, keep it small. Good examples:
- Fix a typo in documentation
- Add a missing `alt` text to an image
- Improve an error message
- Add a test for an untested function

---

## Step 4: Verify Your Change

Before committing, make sure everything passes:

```bash
npm run lint         # ESLint — must have zero warnings
npm run type-check   # TypeScript — must compile cleanly
npm test             # Jest — all tests must pass
```

---

## Step 5: Commit with DCO Sign-off

All commits require a [Developer Certificate of Origin](https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/develop/.github/DCO.md) sign-off. Use the `-s` flag:

```bash
git add .
git commit -s -m "docs(readme): fix typo in quick start section"
```

The `-s` flag adds a `Signed-off-by: Your Name <your@email.com>` line to the commit, certifying you have the right to submit the code under the project's license.

**Commit message format** (enforced by commitlint):
```
type(scope): short description
```

| Type | When to Use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `refactor` | Code restructuring (no behavior change) |
| `test` | Adding or updating tests |
| `chore` | Tooling, dependencies, config |

---

## Step 6: Push and Open a Pull Request

Before you push or open the PR, rebase your branch onto the latest `develop` so the diff stays clean and review only includes your work:

```bash
git fetch upstream
git checkout docs/fix-typo-in-readme
git rebase upstream/develop
```

If you already opened the PR and `develop` moved, rebase again and push the updated branch to the same PR.

```bash
git push origin docs/fix-typo-in-readme
```

Then on GitHub:

1. You'll see a banner: **"Compare & pull request"** — click it
2. **Base branch:** Change to `develop` (not `main`)
3. Fill out the PR template:
   - Describe what you changed and why
   - Reference the issue: `Closes #123`
   - Check the testing boxes
4. Submit the PR

---

## What Happens Next

1. **CI runs automatically** — lint, type-check, tests, security scan, build
2. **A maintainer reviews** — typically within 1 week
3. **You may get feedback** — requested changes are normal and expected. Push additional commits to the same branch
4. **Merge!** — Once approved, a maintainer merges your PR into `develop`

---

## Common Pitfalls

| Mistake | Fix |
|---------|-----|
| Forgot `-s` on commit | `git commit --amend -s` to add sign-off to the last commit |
| PR targets `main` instead of `develop` | Edit the PR on GitHub and change the base branch to `develop` |
| PR includes unrelated commits from an outdated branch | `git fetch upstream && git checkout your-branch && git rebase upstream/develop`, then push the rebased branch |
| Pre-commit hook rejects commit | Run `npm run lint` and `npm run type-check` to see errors, fix them, and try again |
| Commit message rejected by commitlint | Use the format `type(scope): description` — see the types table above |
| Merge conflicts with `develop` | `git checkout develop && git pull upstream develop && git checkout your-branch && git rebase develop` |

---

## Need Help?

- **Discord:** [discord.gg/Wsncg8YYqc](https://discord.gg/Wsncg8YYqc) — ask in the #development channel
- **GitHub Issues:** Comment on the issue you're working on
- **Email:** hello@cursorboston.com

Welcome to Cursor Boston! We're glad you're here.
