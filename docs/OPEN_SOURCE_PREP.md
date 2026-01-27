# Preparing for Open Source: Clean Commit History

This guide explains how to create a fresh, single-commit history for your open source debut.

## Why a Single Commit?

- **Clean History**: No development commits, WIP messages, or internal notes
- **Professional Appearance**: Shows a polished, production-ready project
- **Simplified Review**: Easier for contributors to understand the codebase
- **Privacy**: Hides internal development process and commit patterns

## ⚠️ Important: Security First

**BEFORE creating a clean commit, you MUST:**

1. **Check git history for secrets** (see `docs/SECURITY.md` - Pre-Publication Security Checklist)
2. **Scrub any secrets found** using BFG Repo-Cleaner or git-filter-repo
3. **Rotate all exposed secrets** immediately

**Squashing commits does NOT remove secrets from history!** You must scrub them first.

## Method: Create an Orphan Branch

An orphan branch has no parent commits, giving you a completely fresh start.

### Step 1: Ensure All Work is Committed

```bash
# Check for uncommitted changes
git status

# If you have uncommitted changes, commit them first
git add .
git commit -m "Prepare for open source release"
```

### Step 2: Create Orphan Branch

```bash
# Create a new orphan branch (no history)
git checkout --orphan open-source

# Remove all files from staging (they're still in working directory)
git rm -rf --cached .

# Clean up any untracked files you don't want
# (Review .gitignore to ensure sensitive files aren't included)
```

### Step 3: Add All Files for Open Source

```bash
# Add all files (respecting .gitignore)
git add .

# Verify what will be committed
git status
```

**Double-check that:**
- ✅ `.env.local` is NOT included
- ✅ `.env` is NOT included  
- ✅ `node_modules/` is NOT included
- ✅ `.next/` is NOT included
- ✅ Any other sensitive files are NOT included

### Step 4: Create Single Initial Commit

```bash
# Create a single, clean initial commit
git commit -m "Initial commit: Open source release of Cursor Boston

A modern community platform for Cursor users in the Boston area.
Built with Next.js, TypeScript, and Firebase.

Features:
- Event management and discovery
- Talk submissions
- Member directory
- Blog system
- Authentication (Email, Google, GitHub)
- Discord and GitHub integrations"
```

### Step 5: When Ready to Go Public

**Option A: Replace main branch (Recommended for new repos)**

```bash
# Make open-source branch the new main
git branch -D main                    # Delete old main locally
git branch -m open-source main        # Rename open-source to main

# Force push to remote (⚠️ This rewrites history!)
git push -f origin main
```

**Option B: Keep both branches temporarily**

```bash
# Push the clean branch
git push origin open-source

# Later, when ready, make it the default branch on GitHub
# GitHub Settings → Branches → Change default branch to 'open-source'
# Then delete 'main' branch
```

### Step 6: Verify Clean History

```bash
# Check that you have only one commit
git log --oneline
# Should show only: "Initial commit: Open source release..."

# Verify no secrets in the commit
git show HEAD | grep -i -E "(api[_-]?key|secret|password|token)"
# Should return no results
```

## Alternative: Squash All Commits

If you prefer to keep some history but compress it:

```bash
# Create a backup branch first
git branch backup-main

# Soft reset to the very first commit
git reset --soft $(git rev-list --max-parents=0 HEAD)

# All changes are now staged, create single commit
git commit -m "Initial commit: Open source release of Cursor Boston"
```

**Note**: This still preserves the old history in the backup branch. For a truly clean start, use the orphan branch method above.

## Checklist Before Going Public

- [ ] All secrets scrubbed from git history
- [ ] All secrets rotated (new API keys generated)
- [ ] `.env.local` and `.env` are in `.gitignore`
- [ ] `node_modules/` is in `.gitignore`
- [ ] Build outputs (`.next/`, `out/`, `dist/`) are in `.gitignore`
- [ ] `.env.example` exists with placeholders
- [ ] `LICENSE` file is present
- [ ] `README.md` is complete and professional
- [ ] `docs/SECURITY.md` includes pre-publication checklist
- [ ] All sensitive files excluded from commit
- [ ] Single clean commit created
- [ ] Repository tested (clone fresh and verify it builds)

## After Going Public

1. **Monitor for exposed secrets**: Use tools like [truffleHog](https://github.com/trufflesecurity/trufflehog) to scan
2. **Set up branch protection**: Protect main branch on GitHub
3. **Enable security features**: GitHub Security Advisories, Dependabot
4. **Document contribution process**: Ensure `docs/CONTRIBUTING.md` is clear

## Troubleshooting

**Q: I already pushed to GitHub, can I still do this?**
A: Yes, but you'll need to force push. Coordinate with any collaborators first.

**Q: Will this affect my local development?**
A: The orphan branch is separate. You can keep your old main branch locally for reference.

**Q: What if I need to reference old commits?**
A: Keep a backup branch: `git branch backup-old-main` before creating the orphan branch.

## Summary

The orphan branch method gives you the cleanest possible start:
- No development history
- No WIP commits
- Single professional commit
- Complete privacy of development process

Perfect for open sourcing a project that was previously private!
