# Development Guide

Everything you need to go from clone to running code. This is the single source of truth for local development — if something is missing, [open an issue](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/new).

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | 22.x (see `.nvmrc`) | `node --version` |
| **npm** | >= 9.0.0 | `npm --version` |
| **Git** | any recent | `git --version` |

**Optional:**
- [Firebase CLI](https://firebase.google.com/docs/cli) — needed for emulator workflow and Firestore rules testing
- [gitleaks](https://github.com/gitleaks/gitleaks) — secret scanning in pre-commit hooks (hooks skip gracefully if not installed)

> **Tip:** Use [nvm](https://github.com/nvm-sh/nvm) to manage Node versions. Running `nvm use` in the repo root auto-selects the correct version from `.nvmrc`.

---

## Quick Start (Zero-Config Demo Mode)

Get running in under 2 minutes with no Firebase account:

```bash
git clone https://github.com/your-username/cursor-boston.git
cd cursor-boston
npm install
cp .env.local.demo .env.local
npm run dev
```

Open **http://localhost:3000** — the site loads fully. Layouts, pages, and styling all work.

### What works in demo mode

- All page routes and navigation
- UI components, Tailwind styling, dark/light themes
- Static content (blog posts, cookbook entries from `content/`)
- Lint, type-check, and unit tests

### What requires Firebase setup

- Authentication (sign in/sign up)
- Firestore data (community feed, events, profiles, hackathons)
- File uploads (avatars, project images)
- API routes that read/write data

When you're ready for full functionality, see [Full Firebase Setup](#full-firebase-setup) below.

---

## Full Firebase Setup

Choose the approach that fits your workflow:

### Option A: Personal Firebase project (most common)

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project
2. Enable **Authentication** (Email/Password + Google providers)
3. Create a **Firestore Database** in test mode
4. Create a **Storage** bucket
5. Go to Project Settings > General > Your apps > Add a Web app
6. Copy the config values into `.env.local` (use `.env.local.example` as the template — it has detailed instructions for each field)

### Option B: Firebase Emulator (no cloud account needed)

Requires [Firebase CLI](https://firebase.google.com/docs/cli):

```bash
npm install -g firebase-tools
firebase emulators:start --project demo-cursor-boston
```

Then use `.env.local.demo` as your `.env.local` — the demo project ID (`demo-cursor-boston`) matches the emulator config in `firebase.json`.

> **Note:** The Firebase Admin SDK auto-detects emulators via `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` environment variables. Add these to `.env.local` if you want server-side API routes to use emulators too.

### Formatting `FIREBASE_SERVICE_ACCOUNT_JSON`

Some features (admin scripts, server-side auth) need a Firebase service account. Download the JSON from Firebase Console > Project Settings > Service Accounts, then convert it to a single-line string:

```bash
# macOS/Linux
cat path/to/serviceAccount.json | jq -c . | pbcopy
# Paste the result as the value of FIREBASE_SERVICE_ACCOUNT_JSON in .env.local
```

---

## npm Scripts Reference

| Script | Description | When to Use |
|--------|-------------|-------------|
| `npm run dev` | Start Next.js dev server with HMR | Daily development |
| `npm run build` | Production build (runs `validate-env` first) | Before PR, in CI |
| `npm start` | Start production server (run `build` first) | Test production build locally |
| `npm run lint` | Run ESLint across the codebase | Before committing (also runs in pre-commit hook) |
| `npm run type-check` | TypeScript compilation check (`tsc --noEmit`) | Before committing (also runs in pre-commit hook) |
| `npm test` | Run Jest unit tests | Before PR |
| `npm run test:watch` | Jest in watch mode | During TDD |
| `npm run test:coverage` | Jest with coverage report (text + lcov) | Check coverage metrics |
| `npm run test:rules` | Firestore security rules tests | When editing `config/firebase/firestore.rules` (requires Firebase emulator) |
| `npm run validate-env` | Validate required environment variables | Debugging build failures |

### Admin/Ops Scripts

These require `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env.local`:

| Script | Description |
|--------|-------------|
| `npm run seed-hackathon-teams` | Seed mock hackathon team data for development |
| `npm run check-members-db` | Inspect member records in Firestore |
| `npm run rate-limit-cleanup` | Clean up expired rate limit entries |
| `npm run backfill-merge-credit` | Backfill contributor merge credits (see `docs/CONTRIBUTOR_MERGE_CREDIT_BACKFILL.md`) |
| `npm run send-hack-a-sprint-emails` | Send hackathon event emails (see `docs/HACK_A_SPRINT_2026_OPS.md`) |

---

## Pre-commit Hooks

[Husky](https://typicode.github.io/husky/) runs automatically on every commit. Here's what happens:

### On `git commit`:

1. **gitleaks** (if installed) — scans staged files for accidentally committed secrets
2. **lint-staged** — runs on staged files only:
   - `tsc --noEmit` on `*.ts` and `*.tsx` files (type checking)
   - `eslint --fix --max-warnings=0` on all JS/TS files (auto-fixes what it can, fails on any remaining warnings)
3. **commitlint** — validates your commit message format

### Commit message format

We use [Conventional Commits](https://www.conventionalcommits.org/). Messages must match:

```
type(scope): description
```

**Allowed types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, `release`, `revert`

**Examples:**
```bash
git commit -s -m "feat(cookbook): add prompt template voting"
git commit -s -m "fix(auth): handle expired verification tokens"
git commit -s -m "docs(readme): update quick start instructions"
```

> **Important:** The `-s` flag is required on all commits (Developer Certificate of Origin). See [DCO](.github/DCO.md) for details.

### When a hook fails

- **gitleaks failure:** Check the output for detected secrets. Remove them from staged files before committing.
- **lint-staged / ESLint failure:** Run `npm run lint` to see all errors. Fix them and re-stage.
- **Type check failure:** Run `npm run type-check` to see TypeScript errors.
- **commitlint failure:** Check your message format. Must be `type(scope): description` with an allowed type.

---

## Project Architecture

```
cursor-boston/
  app/                  # Next.js App Router — pages and API routes
    api/                # 63 REST API endpoints (organized by feature)
    (auth)/             # Authentication pages (sign-in, verify-email)
    blog/               # Blog pages
    events/             # Events pages
    hackathons/         # Hackathon pages
    ...
  components/           # Reusable React components
    ui/                 # Base UI components (buttons, cards, modals)
    badges/             # Badge system components
    cookbook/            # Cookbook feature components
    feed/               # Community feed components
    map/                # Interactive map components
    members/            # Member profile components
  lib/                  # Business logic, Firebase clients, utilities
    badges/             # Badge award/check logic
    live-sessions/      # Live session management
    pair-programming/   # Pair matching logic
    firebase.ts         # Firebase client SDK initialization
    firebase-admin.ts   # Firebase Admin SDK (server-side)
    server-auth.ts      # Server-side auth verification
    middleware.ts       # CSRF, rate limiting, request logging
    sanitize.ts         # Input sanitization utilities
    rate-limit.ts       # Rate limiting implementation
  hooks/                # Custom React hooks (useFeed, useAuth, etc.)
  contexts/             # React context providers (AuthContext)
  types/                # TypeScript type definitions
  config/               # Build and test configuration
    firebase/           # Firestore rules and indexes
    jest.config.js      # Jest configuration
    jest.setup.js       # Test environment setup (mocks Firebase env vars)
  scripts/              # Admin and operational scripts
  content/              # Static content (blog posts, showcase data)
  docker/               # Dockerfile and docker-compose.yml
  docs/                 # Documentation
  .github/              # GitHub templates, workflows, community docs
  public/               # Static assets (images, fonts)
```

### Key patterns

- **API routes** use shared middleware: `withLoggingMiddleware()`, `withCsrfProtection()`, `withRateLimitMiddleware()`
- **Authentication** is verified server-side via `getVerifiedUser()` from `lib/server-auth.ts`
- **Input sanitization** uses `lib/sanitize.ts` — always sanitize user input before storing
- **Firestore security rules** are at `config/firebase/firestore.rules` — these are the source of truth for data access control

For the full API endpoint reference, see [docs/API.md](API.md).

---

## Troubleshooting

### "Port 3000 is already in use"

```bash
lsof -ti:3000 | xargs kill -9
# or use a different port:
npm run dev -- --port 3001
```

### npm install fails with peer dependency errors

```bash
rm -rf node_modules package-lock.json
npm install
```

The `package.json` has `overrides` for known peer dependency conflicts.

### Firebase errors in browser console

If you see "API key not valid" or Firebase initialization errors:
- **Expected** when using `.env.local.demo` — Firebase features are intentionally disabled
- For full functionality, set up real Firebase credentials (see [Full Firebase Setup](#full-firebase-setup))

### Pre-commit hook fails

Run the checks manually to see detailed errors:
```bash
npm run lint         # ESLint errors
npm run type-check   # TypeScript errors
```

### "husky: command not found"

```bash
npm run prepare
```

This reinstalls the Husky git hooks. Runs automatically after `npm install` but may need a manual run if hooks were deleted.

### Build fails but dev server works

`npm run build` runs `validate-env` (via the `prebuild` script) before building. It rejects placeholder values like `your-api-key`. Solutions:
- Use `.env.local.demo` — demo values pass validation
- Set up real Firebase credentials in `.env.local`

### Tests fail with Firebase errors

- **Unit tests** (`npm test`): Should work out of the box — `config/jest.setup.js` mocks Firebase environment variables automatically
- **Firestore rules tests** (`npm run test:rules`): Require the Firebase emulator running in a separate terminal (`firebase emulators:start`)

### TypeScript errors after pulling new changes

```bash
rm -rf .next
npm run type-check
```

If errors persist: `rm -rf node_modules && npm install`

---

## Onboarding Checklist

Verify your setup is correct:

- [ ] `node --version` shows v22.x (matches `.nvmrc`)
- [ ] `npm --version` shows >= 9.0.0
- [ ] `npm install` completes without errors
- [ ] `.env.local` exists (copied from `.env.local.demo` or `.env.local.example`)
- [ ] `npm run dev` starts, http://localhost:3000 loads
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] Test commit works: `git commit --allow-empty -s -m "chore: test hooks"` (then `git reset HEAD~1`)

All green? You're ready to contribute! See [Your First Contribution](FIRST_CONTRIBUTION.md) for a step-by-step guide.

---

*Last updated: April 2026. If anything here is wrong or missing, [please open an issue](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/new).*
