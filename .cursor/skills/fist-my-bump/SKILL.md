---
name: fist-my-bump
description: >-
  Generate a social post (LinkedIn/X) amplifying a cohort's weekly project
  submissions. Use for any roundup / shoutout / amplification post built from a
  submissions repo where each builder has a JSON file with a liveUrl, pitch, and a
  shareOnSocials flag.
---

# Fist My Bump

Given a cohort-submissions source, generate a ready-to-post social media roundup that amplifies a week's project submissions, plus a transparency report of who was included/excluded and why.

## Parse the request

Extract from the user message (defaults in parentheses):

| Input | Default / parsing |
|-------|-------------------|
| **Source** | Latest week of `rogerSuperBuilderAlpha/cursor-boston` on `develop` (see [Default source](#default-source)) |
| **Cohort** | Highest `cN` folder under `content/summer-cohort/` |
| **Week** | Highest `wN-*` folder within that cohort |
| **Tone** | `recruiter-facing` |
| **Repo override** | `owner/repo`, branch, submissions path |
| **Week override** | e.g. `c1/w2-comms`, `w3-mkt` |

**Example invocations**

- `fist my bump` → latest week, recruiter tone
- `fist my bump for c1/w2-comms, hype tone`
- `fist my bump from github.com/acme/cohort, week 3`

## Default source

With no arguments:

1. Repo: `rogerSuperBuilderAlpha/cursor-boston`, branch: `develop`
2. Base path: `content/summer-cohort`
3. **Latest cohort** = highest `cN` (e.g. `c2` > `c1`)
4. **Latest week** = highest `wN-*` prefix within that cohort (`w3-mkt` > `w2-comms` > `w1-pm`); break ties by git history / most recently modified
5. Submissions dir: `<week>/submissions/` (sibling `scores/` if present)

## Overrides

The user may specify instead:

- A specific week (e.g. `w2-comms`) and/or cohort (e.g. `c2`)
- An arbitrary directory path within the repo
- An entirely different GitHub repo/project with its own submissions path

Assume the same JSON schema unless told otherwise. If a different repo's schema clearly differs, inspect a sample file and adapt, or ask.

## Fetching from GitHub

**Do not** hammer the unauthenticated GitHub Contents API — it rate-limits fast on shared IPs.

**Preferred:** download the branch archive via codeload and extract only the target path:

```text
https://codeload.github.com/<owner>/<repo>/tar.gz/refs/heads/<branch>
```

Extract the tarball subtree matching the submissions path (and `scores/` if needed). Sparse git checkout is an acceptable alternative.

- Default branch for `cursor-boston`: `develop`
- Other repos: use their default branch unless the user specifies one

## Submission schema

Per `submissions/<handle>.json`:

| Field | Notes |
|-------|--------|
| `githubHandle` | Required for identity |
| `name` | Display name when including with-name mode |
| `repoUrl` | Shipped project repo |
| `liveUrl` | Demo / product URL |
| `loomUrl` | Optional |
| `pitch` | One-liner; often contains project name |
| `competeForWin` | bool |
| `shareOnSocials` | Optional string/bool — see below |
| `photoUrl` | Optional |

Optional sibling `scores/<handle>.json`: `score` (1–10), `rationale`.

There is **no** explicit project-name field — derive display name from the pitch (usually named there) or from the `repoUrl` slug.

## `shareOnSocials` (replaces old `amplify`)

Normalize: trim + lowercase.

| Value | Effect |
|-------|--------|
| `no`, `false` | **EXCLUDE** from all social posts. Opt-out always wins. |
| `yes`, `true`, `name-and-link` | **INCLUDE**, mode = `with-name` (person's name + live URL) |
| `link-only` | **INCLUDE**, mode = `link-only` (project name + live URL only; **no** person name) |
| Unrecognized | Treat as absent → fall back to `competeForWin`; **flag** in report |

## Inclusion logic

Per submission, in order:

1. `shareOnSocials` is `no` / `false` → **EXCLUDE**
2. `shareOnSocials` is `yes` / `true` / `name-and-link` → **INCLUDE**, mode = `with-name`
3. `shareOnSocials` is `link-only` → **INCLUDE**, mode = `link-only`
4. `shareOnSocials` absent → **INCLUDE** only if `competeForWin === true` (mode = `with-name`); else **EXCLUDE**
5. **Reality gate** (applies to every would-be inclusion from 2–4): the project must be actually shipped with a **working** `liveUrl`. If `liveUrl` is dead, `repoUrl` 404s, placeholder/unmodified template text, or pitch self-disclaims as unfinished → **do not post**; flag in report. If they opted in (`yes` / `link-only`) but nothing is live → surface explicitly in report.

## Verification

Before trusting results:

1. **Network control:** `curl -sI -A "Mozilla/5.0" https://example.com`. If even that fails/403s, outbound checks are blocked → fall back to `repoUrl` existence + scores only; state clearly that **live links are UNVERIFIED** and must be spot-checked.
2. **`repoUrl` on GitHub:** HTTP 200 = shipped; 404 = nothing there.
3. **`liveUrl`:** browser User-Agent, follow redirects:
   - `200` / `3xx` = works
   - `401` / `403` = often auth/password gate → include but **FLAG**; offer linking repo instead
   - `404` / `5xx` = broken → exclude via reality gate
4. **`scores/<handle>.json`:** when present, order builders by score (strongest first); use `rationale` to detect "nothing shipped"

## Names / tagging

- **with-name:** use JSON `name`. If missing, try GitHub profile display name; if still unknown, fall back to handle and flag. **Never** fabricate or guess a LinkedIn/X handle from a name — plain-text names only unless the user supplies profile URLs to @mention.
- **link-only:** do **not** include person's name or handle anywhere — project name + live URL only.

## Tone presets

User picks; default **`recruiter-facing`**:

| Preset | Style |
|--------|--------|
| `recruiter-facing` | Professional; lead on hireability; name each build's stack; CTA offering intros; minimal/no emoji |
| `hype` | Energetic; emoji bullets; hashtags; build-in-public |
| `understated` | Plain and factual |

Write descriptions in your own words from pitch + score rationale — **never** copy pitch verbatim.

Order included builders by score when available.

## Output

Deliver **two parts**:

### A) The post

One line per included builder:

- **with-name:** `Name — ProjectName: <one-sentence description> -> <liveUrl>`
- **link-only:** `ProjectName: <one-sentence description> -> <liveUrl>` (no name)

### B) Transparency report

- **Included** (count) with each one's mode (`with-name` / `link-only`)
- **Excluded**, grouped by reason:
  - opt-out (`shareOnSocials` no)
  - `competeForWin` false and no opt-in
  - dead-or-placeholder (reality gate)
- **Opted in but nothing live** flags
- Borderline judgment calls and caveats (unverified live URLs, gated demos)

## Guardrails

- Honor `shareOnSocials` exactly: never attach a name in `link-only` mode; never include an opted-out project
- Never invent people, handles, links, or project details — flag uncertainty; don't guess
- Never amplify a real person next to a broken or embarrassing submission
