# Security Incident Report: Cursor Credit Codes Exposure

**Date:** April 11, 2026
**Reported by:** Roger Hunt (repo owner)
**Severity:** Medium (financial — $50 referral codes, 50 total = $2,500 potential exposure)

---

## Summary

50 Cursor referral credit codes (each worth $50) were accidentally committed to the public repository `rogerSuperBuilderAlpha/cursor-boston` and remained publicly visible for approximately 15 hours before being discovered and removed.

## Timeline (all times ET)

| Time | Event |
|------|-------|
| Apr 11, ~08:49 AM | Commit `80598d1` pushed to `develop` containing `docs/cursor_credits_links_4_13/Cursor Boston April - Sheet1.csv` with 50 Cursor referral URLs |
| Apr 11, ~08:49 AM | Commit merged to `main` shortly after |
| Apr 11, ~07:27 PM | **Pradyumna369** forks the repo (only fork created during exposure window) |
| Apr 11, ~11:00 PM | Exposure discovered; file deleted from `develop` and `main` |
| Apr 11, ~11:05 PM | `git filter-repo` used to scrub file from entire git history |
| Apr 11, ~11:10 PM | Force-pushed rewritten history to GitHub (branch protection temporarily disabled, then restored) |
| Apr 11, ~11:15 PM | PR #357 (from Pradyumna369, containing the file in diff) closed |
| Apr 11, ~11:20 PM | All 50 codes in Firestore replaced with placeholder values |
| Apr 11, ~11:30 PM | `.gitignore` entry added for `docs/cursor_credits_links_4_13/` |

## Exposed Data

- **File:** `docs/cursor_credits_links_4_13/Cursor Boston April - Sheet1.csv`
- **Contents:** 50 Cursor referral URLs in the format `https://cursor.com/referral?code=XXXXXXXXXX`
- **Value:** $50 per code, $2,500 total

## Blast Radius

### Confirmed exposure

| Vector | Status |
|--------|--------|
| GitHub web UI (file browsable) | ~15 hours |
| Git clone / pull | Anyone who cloned during the window |
| Pradyumna369 fork | **Still has the file** (cannot be removed by repo owner) |

### Traffic during exposure window (GitHub Insights, last 14 days)

- **681 unique cloners**, 5,404 total clones (aggregate — GitHub does not identify individual cloners)
- **111 unique viewers**
- **1 fork created** during window: Pradyumna369 (not a registered event participant)

### Verified clean

| Vector | Status |
|--------|--------|
| `main` branch | File removed, history scrubbed |
| `develop` branch | File removed, history scrubbed |
| All other remote branches (56 checked) | Clean |
| Old commit SHA (`80598d1`) | Returns 404 on GitHub |
| Closed PR #357 diff | Files no longer returned by API |
| GitHub code search (file path) | 0 results |
| GitHub code search (referral codes) | 0 results |
| All forks except Pradyumna369 | Clean (29 checked) |

## Remaining Exposure

The file remains on **two forks**:

1. [`Pradyumna369/cursor-boston`](https://github.com/Pradyumna369/cursor-boston/blob/develop/docs/cursor_credits_links_4_13/Cursor%20Boston%20April%20-%20Sheet1.csv) (develop branch) — forked after codes were pushed
2. [`pavithralagisetty/cursor-boston`](https://github.com/pavithralagisetty/cursor-boston/blob/main/docs/cursor_credits_links_4_13/Cursor%20Boston%20April%20-%20Sheet1.csv) (main branch) — forked March 30, synced with upstream during exposure window

These forks cannot be modified or deleted by the upstream repo owner. Removal requires a GitHub support request for each.

## Remediation

1. **Codes replaced in Firestore** — all 50 `hackathonCreditCodes` docs now contain placeholder values; real codes will be re-seeded from new codes provided by Cursor
2. **History scrubbed** — `git filter-repo` removed the file from all commits; force-pushed to GitHub
3. **Gitignore updated** — `docs/cursor_credits_links_4_13/` added to `.gitignore`
4. **PR closed** — PR #357 (which included the file in its diff) was closed
5. **Codes should be treated as compromised** — request replacement codes from Cursor

## Action Items

- [ ] Request new referral codes from Cursor (treat all 50 originals as burned)
- [ ] File GitHub support request to remove file from Pradyumna369 fork: [github.com/contact](https://github.com/contact) → "Report a security vulnerability"
- [ ] Seed new codes into Firestore via `npx tsx scripts/seed-credit-codes.ts --write --csv path/to/new-codes.csv`
- [ ] Consider adding a pre-commit hook or CI check to prevent committing files matching `*credit*` or `*referral*` patterns

## Lessons Learned

1. Sensitive data (credit codes, API keys, tokens) must never be committed to the repository — store in Firestore or environment variables behind authentication
2. The credit code seeding workflow should read from a local file and write directly to Firestore, with the local file gitignored from the start
3. A secrets scanning tool (e.g., GitHub Secret Scanning, truffleHog, or git-secrets) should be added to CI to catch accidental commits
