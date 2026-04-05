# Contributing to Cursor Boston

Thank you for your interest in contributing to Cursor Boston! This document provides guidelines and instructions for contributing to the project.

> **New contributor?** Start with the [First Contribution Guide](../docs/FIRST_CONTRIBUTION.md) for a step-by-step walkthrough, or the [Development Guide](../docs/DEVELOPMENT.md) for complete setup instructions, npm scripts, troubleshooting, and architecture overview.

## Contribution policy (fork and pull request only)

**If you are contributing code or content, you must use the fork workflow.** Fork this repo on GitHub, set **`origin` to your fork**, push branches there, and open a **pull request** into `rogerSuperBuilderAlpha/cursor-boston` with base branch **`develop`**. Do **not** push feature branches directly to the upstream repository (you typically will not have permission; if you do, that path is still not the supported contribution model). Maintainers merge approved PRs; contributors do not self-merge unless [GOVERNANCE](GOVERNANCE.md) explicitly allows it.

A read-only clone of upstream is fine for browsing or local experimentation, but anything you intend to merge must go through **fork → branch on your fork → PR**.

## Branching model (`develop` and `main`)

- **`develop`** is the **default branch** on GitHub. Open **all** contributor pull requests against `develop`. That branch is the integration line: reviews, CI, and Vercel **preview** deploys (when the integration is connected).
- **`main`** tracks **production**. Changes reach `main` only through a **release PR** from `develop` after maintainers batch and review what should ship. That keeps production history and deployments controlled.
- After a release merge, maintainers sync **`develop`** with **`main`** so both stay aligned.

## Table of Contents

- [Contribution policy (fork and pull request only)](#contribution-policy-fork-and-pull-request-only)
- [Branching model (develop and main)](#branching-model-develop-and-main)
- [Code of Conduct](#code-of-conduct)
- [Developer Certificate of Origin](#developer-certificate-of-origin)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Claiming an Issue](#claiming-an-issue)
- [Code Style and Conventions](#code-style-and-conventions)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Areas for Contribution](#areas-for-contribution)
- [Getting Help](#getting-help)

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to hello@cursorboston.com.

## Developer Certificate of Origin

This project uses the [Developer Certificate of Origin (DCO)](DCO.md) to ensure that contributors have the right to submit their contributions under the project's open source license.

**All commits must be signed off** to indicate your agreement with the DCO:

```bash
git commit -s -m "Your commit message"
```

The `-s` flag adds a `Signed-off-by` line to your commit message:

```
Signed-off-by: Your Name <your.email@example.com>
```

Make sure your Git name and email are configured:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

Pull requests with unsigned commits will not be merged. See [DCO.md](DCO.md) for more details.

## Getting Started

Follow the **[Development Guide](../docs/DEVELOPMENT.md)** for complete setup instructions, including:

- Prerequisites (Node.js 22, npm >= 9)
- **Zero-config demo mode** — run `cp .env.local.demo .env.local && npm run dev` with no Firebase account
- Full Firebase setup (personal project or emulator)
- All npm scripts with descriptions
- Pre-commit hooks explained
- Troubleshooting common issues
- Onboarding checklist to verify your setup

**Quick version:**

```bash
git clone https://github.com/your-username/cursor-boston.git
cd cursor-boston
git remote add upstream https://github.com/rogerSuperBuilderAlpha/cursor-boston.git
npm install
cp .env.local.demo .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Development Workflow

### Finding Issues to Work On

- Browse [GitHub Issues](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues) for open tasks
- Look for issues labeled `good first issue` if you're new to the project
- Issues labeled `help wanted` are actively seeking contributors
- **Feature projects** (issues [#78](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/78)–[#83](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/83)) are fully scoped, isolated features ready to build — see the [Claiming an Issue](#claiming-an-issue) section below

### Branch Naming

Use descriptive branch names that indicate the type of change:

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `style/description` - Code style changes (formatting, etc.)

Examples:
- `feature/add-dark-mode-toggle`
- `fix/mobile-navigation-bug`
- `docs/update-readme-setup`

### Keeping Your Fork Updated

Regularly sync your fork with the upstream repository:

```bash
git fetch upstream
git checkout develop
git merge upstream/develop
```

## Claiming an Issue

### Step 1 — Find an issue

Open issues are at [github.com/rogerSuperBuilderAlpha/cursor-boston/issues](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues).

We have **6 standalone feature projects** that are great for contributors who want to build something end-to-end:

| Issue | Feature |
|-------|---------|
| [#78](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/78) | Prompt & Rules Cookbook |
| [#79](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/79) | Achievement Badge System |
| [#80](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/80) | AI Pair Programming Matchmaker |
| [#81](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/81) | Public Community Analytics Dashboard |
| [#82](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/82) | Interactive Community Event Map |
| [#83](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/83) | Lightning Talk Timer & Speaker Queue |

Each issue contains a full spec: summary, motivation, proposed features, technical notes, and design guidance. They are fully isolated — new routes and new Firestore collections with no changes required to existing code.

### Step 2 — Claim it

Leave a comment on the issue saying you'd like to work on it, e.g.:

> "I'd like to take this on. Planning to start this week."

A maintainer will assign it to you. Only one person works on a given issue at a time — check whether someone is already assigned before commenting.

### Step 3 — Build it

Create a feature branch from `develop`:

```bash
git checkout develop && git pull upstream develop
git checkout -b feature/your-feature-name
```

Reference the issue number in your commits so GitHub links them automatically:

```bash
git commit -s -m "feat(cookbook): add browse and search page

Closes #78"
```

### Step 4 — Open a PR

When your work is ready, open a pull request against **`develop`** (the default base branch). In the PR description:

1. **Link the issue** using a closing keyword so it auto-closes on merge:
   ```
   Closes #78
   ```
2. Fill out the [PR description template](#pr-description-template) — include screenshots for any UI work.
3. Make sure `npm run lint` and `npm run build` pass before requesting review.

Maintainers will review and provide feedback. Once approved, your PR will be merged into `develop`. The issue will close when that merge completes (if you used a closing keyword). Releases to production go through a separate maintainer PR from `develop` to `main`.

### Etiquette

- If you claim an issue but can no longer work on it, please leave a comment so someone else can pick it up.
- Don't open a PR for an issue that is already assigned to someone else without coordinating first.
- Partial work is welcome — open a draft PR early to show progress and get early feedback.

## Code Style and Conventions

### TypeScript

- **Use strict types** - Avoid `any` whenever possible
- **Define interfaces** - Create interfaces for form data, API responses, and component props
- **Use type guards** - For error handling and type narrowing
- **Export types** - Make types reusable when appropriate

Example:
```typescript
interface UserProfile {
  displayName: string;
  email: string;
  photoURL?: string;
}

function isUserProfile(obj: unknown): obj is UserProfile {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'displayName' in obj &&
    'email' in obj
  );
}
```

### React Patterns

- **Server Components First** - Use React Server Components by default
- **Client Components When Needed** - Only use `"use client"` when you need:
  - React hooks (useState, useEffect, etc.)
  - Event handlers (onClick, onChange, etc.)
  - Browser APIs (localStorage, window, etc.)
- **Component Organization** - Keep components focused and single-purpose

### Styling

- **Tailwind CSS** - Use utility classes for styling
- **Design System** - Follow patterns defined in `app/globals.css`
- **Responsive Design** - Always consider mobile, tablet, and desktop
- **Accessibility** - Include focus states and ARIA labels

Example:
```tsx
<button className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
  Click me
</button>
```

### File Organization

```
app/              # Next.js App Router pages
components/       # Reusable React components
contexts/        # React context providers
lib/             # Utility functions and helpers
content/         # Static content (blog posts, JSON)
public/          # Static assets
```

### Naming Conventions

- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`)
- **Files**: Match the default export name when possible

## Making Changes

### Before You Start

1. **Check existing work**
   - Search issues and pull requests to avoid duplicate work
   - Check if someone is already working on the feature

2. **Discuss major changes**
   - Open an issue first for significant features
   - Get feedback before implementing large changes

3. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(auth): add GitHub OAuth integration

Signed-off-by: Jane Developer <jane@example.com>
```

```
fix(members): resolve mobile navigation bug

Signed-off-by: John Contributor <john@example.com>
```

```
docs(readme): update installation instructions

Signed-off-by: Alex Writer <alex@example.com>
```

### Commit Best Practices

- Write clear, descriptive commit messages
- Keep commits focused (one logical change per commit)
- Reference issue numbers: `fix #123: resolve navigation bug`
- Use present tense: "Add feature" not "Added feature"
- Always sign off your commits with `-s` flag (required for DCO)

## Testing

Automated tests run via Jest (and in CI), but please test your changes thoroughly:

### Manual Testing Checklist

- [ ] **Functionality** - Feature works as expected
- [ ] **Responsive Design** - Test on mobile, tablet, and desktop
- [ ] **Browser Compatibility** - Test in Chrome, Firefox, Safari
- [ ] **Authentication** - Test login, signup, and profile flows
- [ ] **Forms** - Test form submissions and validation
- [ ] **Accessibility** - Test keyboard navigation and screen readers
- [ ] **Performance** - Check for console errors and warnings
- [ ] **Build** - Verify `npm run build` succeeds

### Testing Authentication

If you've modified auth-related code:

1. Test email/password signup and login
2. Test Google OAuth flow
3. Test GitHub OAuth flow
4. Test profile updates
5. Test logout functionality

### Testing Forms

If you've modified forms:

1. Test form validation
2. Test error messages
3. Test successful submissions
4. Test loading states
5. Test form reset after submission

## Pull Request Process

### Before Submitting

1. **Ensure your code works**
   ```bash
   npm run lint      # Check for linting errors
   npm run build     # Verify the app builds
   ```

2. **Update documentation**
   - Update README.md if you've changed setup instructions
   - Add JSDoc comments for new functions
   - Update type definitions if needed

3. **Test your changes**
   - Follow the [Testing](#testing) checklist above
   - Test edge cases and error scenarios

4. **Pre-commit hooks run automatically** when you commit:
   - **gitleaks** — scans staged files for accidentally committed secrets
   - **lint-staged** — runs `tsc --noEmit` and `eslint --fix --max-warnings=0` on staged files
   - **commitlint** — validates commit message format ([Conventional Commits](https://www.conventionalcommits.org/))

   If a hook fails, fix the issue and try again. See [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md#pre-commit-hooks) for details.

### PR Description Template

Use this structure for your PR description:

```markdown
## Description
Brief description of what this PR does.

Fixes #(issue number)

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested your changes.

## Screenshots
Add screenshots for UI changes.

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Changes tested locally
```

### PR Best Practices

- **Keep PRs focused** - One feature or fix per PR
- **Keep PRs reasonably sized** - Large PRs are harder to review
- **Write clear descriptions** - Explain what and why, not just how
- **Add screenshots** - For UI changes
- **Reference issues** - Link to related issues
- **Respond to feedback** - Be open to suggestions and questions

### Review Process

1. Maintainers will review your PR (targeting `develop`)
2. Address any feedback or requested changes
3. Once approved, your PR will be merged into `develop`
4. Thank you for contributing! 🎉

## Areas for Contribution

We welcome contributions in these areas:

### Feature Projects (claim one and build it end-to-end)

These are fully scoped, isolated features with no dependencies on existing code. See [Claiming an Issue](#claiming-an-issue) for how to get started.

- [#78](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/78) **Prompt & Rules Cookbook** — share and discover Cursor workflows
- [#79](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/79) **Achievement Badge System** — gamified milestones for community activity
- [#80](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/80) **AI Pair Programming Matchmaker** — find your coding partner
- [#81](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/81) **Public Community Analytics Dashboard** — visualize community growth
- [#82](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/82) **Interactive Community Event Map** — Boston venues on a live map
- [#83](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/83) **Lightning Talk Timer & Speaker Queue** — real-time event tool

### High Priority

- **Bug Fixes** - Fix issues reported in the issue tracker
- **Documentation** - Improve README, add code comments, write tutorials
- **Accessibility** - Improve keyboard navigation, ARIA labels, screen reader support

### Medium Priority

- **Performance** - Optimize bundle size, improve load times
- **UI/UX** - Improve design, add animations, enhance mobile experience

### Always Welcome

- **Code Quality** - Refactoring, improving type safety
- **Testing** - Adding tests, improving test coverage
- **Examples** - Creating example implementations
- **Translations** - Adding i18n support (future)

## Getting Help

If you have questions or need help:

1. **Check Documentation**
   - Read the [README](https://github.com/rogerSuperBuilderAlpha/cursor-boston?tab=readme-ov-file)
   - Review existing issues and discussions

2. **Ask Questions**
   - Open an issue with the `question` label
   - Be specific about what you're trying to do

3. **Get Community Support**
   - Join our [Discord server](https://discord.gg/Wsncg8YYqc)
   - Check our [Luma events](https://lu.ma/cursor-boston)

4. **Report Issues**
   - Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md)
   - Include steps to reproduce and environment details

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [React Documentation](https://react.dev)

---

Thank you for contributing to Cursor Boston! Your contributions help make this community platform better for everyone. 🎉
