# Open PR Reviews - February 18, 2026

## PR #76: deps(deps): bump fast-xml-parser and @google-cloud/storage
**Author:** dependabot[bot]
**Verdict: MERGE**

### Review
This is an automated Dependabot PR that bumps:
- `fast-xml-parser` from 4.5.3 to 5.3.6 (major version bump with security fixes)
- `@google-cloud/storage` from 7.18.0 to 7.19.0

The fast-xml-parser update includes critical security improvements: `maxEntitySize`, `maxExpansionDepth`, and `maxTotalExpansions` settings to prevent XML entity expansion attacks. The @google-cloud/storage update adds checksum validation and itself depends on fast-xml-parser v5.

Only `package-lock.json` changes (22 lines). Vercel deployment succeeded. Low risk.

---

## PR #75: refactor: split profile page into components, hooks, and icons
**Author:** littlepuppi
**Verdict: CLOSE**

### Review
This PR splits the monolithic 2,539-line profile page into components, hooks, and icons. While the intent is good, there are concerns:

1. **Conflict with PR #74**: Both PRs modify `app/(auth)/profile/page.tsx` and extract icons. They will conflict if both are merged.
2. **`--no-verify` bypass**: The contributor bypassed pre-commit hooks, indicating the code may not pass linting.
3. **Includes `.bak` file**: `page.tsx.bak` should not be committed to the repository.
4. **Overlapping scope with #74**: PR #74 focuses specifically on icon extraction while this PR tries to do everything at once (components, hooks, AND icons).

If you want a comprehensive profile page refactor, this PR needs revision: remove the `.bak` file, fix lint issues without bypassing hooks, and coordinate with PR #74 on icon extraction.

---

## PR #74: Feature/extract icon components
**Author:** g3x-gauransh
**Verdict: MERGE (with minor feedback)**

### Review
This PR creates a centralized `components/icons/index.tsx` file and extracts inline SVGs from the profile page and ProfileRequirementsModal. Clean, focused changes:

- New `components/icons/index.tsx` with 6 icon components (CalendarIcon, DiscordIcon, GitHubIcon, LayersIcon, PlusIcon, UserCardIcon)
- Each icon accepts `size` and `className` props
- Removes 152 lines of inline SVG from profile page
- Also updates ProfileRequirementsModal

This is a well-scoped refactor that improves maintainability. The only concern is that Vercel deployment is pending authorization.

---

## PR #73: fix: wrap refreshUserProfile in useCallback
**Author:** avadhanamvinayarekha
**Verdict: CLOSE**

### Review
This PR wraps `refreshUserProfile` in `useCallback` with an empty dependency array `[]`. There are issues:

1. **Stale closure bug**: The function uses `auth?.currentUser` and `db`, but with `[]` as dependencies these values will be captured from the initial render and never update. If the user logs in/out, `refreshUserProfile` will reference stale auth state.
2. **Unnecessary optimization**: `refreshUserProfile` is defined inside the AuthProvider which only re-renders on auth state changes. The function is passed via context value, so wrapping it in `useCallback` without proper dependencies doesn't meaningfully prevent re-renders - the context value object is recreated on every render regardless.
3. **Incorrect dependency array**: If using `useCallback`, the dependency array should include `[auth, db, setUserProfile]`, not `[]`. The PR description mentions `[setUserProfile]` but the actual code uses `[]`.

This change introduces a subtle bug (stale closures) in exchange for negligible performance benefit.

---

## Summary

| PR | Title | Recommendation | Reason |
|----|-------|---------------|--------|
| #76 | Dependency bumps (security) | **MERGE** | Security fix, low risk, automated |
| #75 | Profile page refactor | **CLOSE** | Conflicts with #74, bypasses hooks, includes .bak file |
| #74 | Extract icon components | **MERGE** | Clean, focused refactor |
| #73 | useCallback optimization | **CLOSE** | Introduces stale closure bug, empty dep array |
