# Placeholder Value Guidelines

## Principle

This project serves **two purposes**:
1. **Production project** - The actual Cursor Boston community platform
2. **Open source template** - Forkable by others to create their own communities

## Correct Approach

### ✅ Production Code Files (Use REAL Values)

These files should contain **actual values** for the Cursor Boston project:

- `package.json` - Use `rogerSuperBuilderAlpha` (actual GitHub org)
- `README.md` - Use actual GitHub URLs, domain, email
- `app/layout.tsx` - Use actual domain (`cursorboston.com`)
- `lib/github.ts` - Use `rogerSuperBuilderAlpha` as default fallback
- `components/Footer.tsx` - Use actual email (`hello@cursorboston.com`)
- `app/about/page.tsx` - Use actual email and domain
- All other production code files

**Why?** These are the actual values for the running project. They should work out of the box.

### ✅ Template Files (Use PLACEHOLDERS)

These files should contain **placeholders** for others to replace:

- `.env.local.example` - Use `your-org`, `your-domain`, etc.
- Documentation that shows examples for forking

**Why?** This is a template file that others copy. They need to replace values.

### ✅ Code Defaults (Use REAL Values with Env Override)

In code files like `lib/github.ts`:

```typescript
// ✅ CORRECT: Real value as default, but can be overridden via env
const REPOSITORY_OWNER = process.env.GITHUB_REPO_OWNER || "rogerSuperBuilderAlpha";
```

**Why?** 
- Works for the actual project without configuration
- Others can override via `.env.local` when forking
- Best of both worlds

## Summary

| File Type | Use Real Values? | Use Placeholders? |
|-----------|-----------------|-------------------|
| `package.json` | ✅ Yes | ❌ No |
| `README.md` (actual links) | ✅ Yes | ❌ No |
| `README.md` (forking instructions) | ❌ No | ✅ Yes |
| `.env.local.example` | ❌ No | ✅ Yes |
| Code files (defaults) | ✅ Yes | ❌ No |
| Code files (env vars) | ✅ Yes (as fallback) | ❌ No |

## When Forking

When someone forks this project, they should:
1. Copy `.env.local.example` to `.env.local`
2. Replace placeholders in `.env.local` with their values
3. Update `package.json` with their GitHub org
4. Update domain/email references in code files
5. The code defaults will be overridden by their `.env.local` values

## Current State

- ✅ `package.json` - Has real values (correct)
- ✅ `lib/github.ts` - Has real default values (correct)
- ⚠️ `.env.local.example` - Should have placeholders, not real values
- ✅ Production code files - Should have real values
