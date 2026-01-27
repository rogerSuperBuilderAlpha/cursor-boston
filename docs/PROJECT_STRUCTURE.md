# Project Structure

This document explains the organization of the Cursor Boston repository.

## Root Directory

### Documentation Files
- `README.md` - Main project documentation and getting started guide
- `docs/CONTRIBUTING.md` - Guidelines for contributors
- `docs/CODE_OF_CONDUCT.md` - Community code of conduct
- `docs/SECURITY.md` - Security policy and vulnerability reporting
- `docs/CHANGELOG.md` - Version history and changes
- `docs/DEVELOPMENT.md` - Development guide and tooling documentation
- `docs/PRODUCTION_READINESS.md` - Production deployment checklist
- `docs/PROJECT_STRUCTURE.md` - This file
- `LICENSE` - GNU GPL v3.0 license

### Configuration Files

#### Next.js & TypeScript
- `package.json` - Node.js dependencies and scripts
- `package-lock.json` - Locked dependency versions
- `tsconfig.json` - TypeScript compiler configuration
- `next.config.js` - Next.js framework configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration

#### Firebase
- `.firebaserc` - Firebase project aliases (local config)
- `firebase.json` - Firebase CLI configuration (must be in root)
- `config/firebase/firestore.rules` - Firestore security rules
- `config/firebase/firestore.indexes.json` - Firestore database indexes
- `config/firebase/storage.rules` - Firebase Storage security rules
- `config/firebase/cors.json` - Firebase Storage CORS configuration

#### Testing & Development Tools
- `config/jest.config.js` - Jest test configuration
- `config/jest.setup.js` - Jest test setup file

#### Environment & Git
- `.env.local.example` - Environment variables template
- `.gitignore` - Git ignore patterns
- `.nvmrc` - Node.js version specification

## Directory Structure

```
cursor-boston/
├── .cursor/              # Cursor IDE configuration and rules
│   └── rules/            # AI assistant guidelines and rules
├── .github/              # GitHub templates and workflows
│   ├── ISSUE_TEMPLATE/   # Issue templates
│   ├── workflows/        # GitHub Actions workflows
│   │   └── ci.yml        # Continuous Integration workflow
│   └── PULL_REQUEST_TEMPLATE.md
├── app/                   # Next.js App Router pages
│   ├── (auth)/           # Authentication routes (grouped)
│   ├── about/             # About page
│   ├── api/               # API routes
│   ├── blog/              # Blog pages
│   ├── events/            # Events pages
│   ├── members/           # Member directory
│   ├── talks/             # Talks pages
│   └── ...                # Root layout and global styles
├── components/            # Reusable React components
├── contexts/              # React context providers
├── content/               # Static content files
│   ├── blog/              # Markdown blog posts
│   ├── events.json        # Event data
│   └── talks.json         # Talk data
├── config/                # Configuration files
│   ├── firebase/          # Firebase configuration files
│   │   ├── firestore.rules
│   │   ├── firestore.indexes.json
│   │   ├── storage.rules
│   │   └── cors.json
│   ├── jest.config.js     # Jest test configuration
│   └── jest.setup.js      # Jest test setup
├── docs/                  # Documentation files
│   ├── CONTRIBUTING.md
│   ├── CODE_OF_CONDUCT.md
│   ├── SECURITY.md
│   ├── CHANGELOG.md
│   ├── DEVELOPMENT.md
│   ├── PRODUCTION_READINESS.md
│   └── PROJECT_STRUCTURE.md
├── lib/                   # Utility functions and helpers
├── public/                # Static assets (images, icons, etc.)
└── [config files]         # Root-level configuration files
```

## File Organization Principles

1. **Essential config files in root** - Required by build tools (package.json, tsconfig.json, next.config.js, firebase.json)
2. **Documentation in docs/** - All project documentation organized in one place
3. **Firebase configs in config/firebase/** - Firebase rules and indexes organized together
4. **Test configs in config/** - Jest configuration files organized together
5. **Code organized by feature** - Components, pages, utilities grouped logically
6. **Static content separate** - Content files in dedicated directory
7. **Internal docs in .cursor/** - IDE-specific documentation

## Firebase Configuration

Firebase CLI requires `firebase.json` in the root directory. Other Firebase configuration files are organized in `config/firebase/`:

- `firebase.json` - Main Firebase configuration (must be in root)
- `.firebaserc` - Project aliases (not committed, local only)
- `config/firebase/firestore.rules` - Referenced in `firebase.json`
- `config/firebase/firestore.indexes.json` - Referenced in `firebase.json`
- `config/firebase/storage.rules` - Referenced in `firebase.json`
- `config/firebase/cors.json` - Used for Firebase Storage CORS setup

## Environment Variables

- `.env.local.example` - Template file (committed)
- `.env.local` - Actual environment variables (not committed, gitignored)

Never commit `.env.local` or any file containing secrets!

## Adding New Files

- **New pages**: Add to `app/` following Next.js App Router conventions
- **New components**: Add to `components/`
- **New utilities**: Add to `lib/`
- **New content**: Add to `content/`
- **New config**: Add to root if required by tooling, otherwise organize appropriately
