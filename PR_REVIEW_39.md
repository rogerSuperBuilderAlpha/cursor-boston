# PR #39 Review: Update contributing guide links to use GitHub URL

## Summary

This PR updates links to CONTRIBUTING.md and README.md across four files, replacing
relative paths and broken URLs with GitHub's `?tab=` URL format.

**Files changed:** 4 (`.github/CONTRIBUTING.md`, `app/(auth)/profile/page.tsx`,
`app/open-source/page.tsx`)

**Commits:** 2

---

## Findings

### Fix: Broken link in profile page (positive)

The old link in `app/(auth)/profile/page.tsx:1040` pointed to:

```
https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/master/docs/CONTRIBUTING.md
```

This was a **404** for two reasons:
1. The file path is `.github/CONTRIBUTING.md`, not `docs/CONTRIBUTING.md`
2. The link references branch `master`, though the default branch is `main`

The new link `?tab=contributing-ov-file#readme` resolves correctly. This is a clear improvement.

### Fix: Updated link in open-source page (neutral)

The old link in `app/open-source/page.tsx` pointed to:

```
https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/main/.github/CONTRIBUTING.md
```

This link was already working. The new `?tab=contributing-ov-file#readme` URL also works
and is consistent with the profile page fix. No issue here.

### Issue: Broken anchor `#configuration` in CONTRIBUTING.md

In `.github/CONTRIBUTING.md`, the link was changed from:

```
../README.md#configuration
```

to:

```
https://github.com/rogerSuperBuilderAlpha/cursor-boston?tab=readme-ov-file#configuration
```

The README **does not have a `#configuration` section**. The anchor `#configuration`
does not resolve to any heading. This was already broken before this PR (the old relative
link had the same problem), but this would be a good opportunity to fix it — either by
removing the anchor or adding a Configuration section to the README.

### Trade-off: Relative links replaced with absolute URLs in CONTRIBUTING.md

The second change in CONTRIBUTING.md replaces `README.md` (line 401) with the absolute
GitHub URL. The old relative link (`README.md`) resolved to `.github/README.md` from
GitHub's perspective, which doesn't exist — so this is also a fix. However, using absolute
URLs in markdown means the links won't work for someone reading the files locally in a
cloned repo. This is a minor trade-off that's generally acceptable for a GitHub-hosted
project.

---

## Verdict

**Approve with minor suggestion.** The PR fixes a genuinely broken link in the profile
page (404) and improves consistency across the codebase. The one item worth addressing
is the `#configuration` anchor that points to a non-existent README section — though
this is a pre-existing issue, not introduced by this PR.
