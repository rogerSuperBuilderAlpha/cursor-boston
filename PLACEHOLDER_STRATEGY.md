# Placeholder Strategy - The Correct Approach

## The Problem

We've been going back and forth on whether to use placeholders (`your-org`) or real values (`rogerSuperBuilderAlpha`). Here's the **correct approach**:

## The Solution: Two Different Contexts

### 1. Production Code = Real Values ✅

**Files that should have REAL values:**
- `package.json` → `rogerSuperBuilderAlpha` (actual GitHub org)
- `README.md` → Real GitHub URLs, domain, email
- `app/layout.tsx` → `cursorboston.com` (actual domain)
- `lib/github.ts` → `rogerSuperBuilderAlpha` as default
- `components/Footer.tsx` → `hello@cursorboston.com` (actual email)
- All production code files

**Why?** This is the actual running project. It should work with real values.

### 2. Template Files = Placeholders ✅

**Files that should have PLACEHOLDERS:**
- `.env.local.example` → `your-org`, `your-domain`, etc.

**Why?** This is a template that others copy. They need to replace values.

### 3. Code Defaults = Real Values (with env override) ✅

**Pattern in code files:**
```typescript
// ✅ CORRECT: Real value as default, overridable via env
const REPOSITORY_OWNER = process.env.GITHUB_REPO_OWNER || "rogerSuperBuilderAlpha";
```

**Why?** 
- Works for the actual project without config
- Others can override via `.env.local` when forking
- Best of both worlds

## Current Status

| File | Current State | Should Be |
|------|--------------|-----------|
| `package.json` | ✅ Real values | ✅ Real values |
| `lib/github.ts` | ✅ Real default | ✅ Real default |
| `.env.local.example` | ✅ Placeholders | ✅ Placeholders |
| `README.md` | ✅ Real values | ✅ Real values |
| Production code | ✅ Real values | ✅ Real values |

## When Someone Forks

1. They copy `.env.local.example` → `.env.local`
2. Replace `your-org` with their GitHub org in `.env.local`
3. The code uses their env var, overriding the default
4. They update `package.json` and other files with their values

## Rule of Thumb

- **If it's in the codebase and runs in production** → Use real values
- **If it's a template file (`.example`, docs for forking)** → Use placeholders
- **If it's a code default** → Use real value, allow env override

## No More Confusion! 🎯

The key insight: **Production code uses real values, template files use placeholders.**
