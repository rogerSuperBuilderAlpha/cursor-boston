# Security Policy

## Supported Versions

We actively support security updates for the latest version of Cursor Boston. Please ensure you're running the latest version to receive security patches.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **hello@cursorboston.com**

### What to Include

When reporting a vulnerability, please include:

1. **Description** - A clear description of the vulnerability
2. **Steps to Reproduce** - Detailed steps to reproduce the issue
3. **Impact** - Potential impact of the vulnerability
4. **Suggested Fix** - If you have ideas for how to fix it (optional but appreciated)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Depends on severity and complexity

### What to Expect

- We will acknowledge receipt of your report
- We will investigate and verify the vulnerability
- We will keep you updated on our progress
- We will credit you in the security advisory (if you wish)
- We will work to release a fix as soon as possible

### Disclosure Policy

- We will not disclose the vulnerability publicly until a fix is available
- We will coordinate with you on the disclosure timeline
- We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

If you're deploying Cursor Boston:

1. **Environment Variables** - Never commit `.env.local` files
   - Verify `.env.local` is in `.gitignore`
   - Use `.env.local.example` as a template
   - Set production environment variables in your deployment platform
2. **Firebase Security Rules** - Review and customize Firestore and Storage rules
   - Deploy rules: `firebase deploy --only firestore:rules,storage:rules`
   - Test rules thoroughly before production
   - Review rules regularly for security gaps
3. **Authentication** - Use strong authentication methods
   - Enable 2FA for admin accounts
   - Use OAuth providers with proper redirect URIs
   - Regularly review authorized domains in Firebase
4. **HTTPS** - Always use HTTPS in production
   - Ensure SSL certificates are valid and auto-renewing
   - Use HSTS headers where possible
5. **Dependencies** - Keep dependencies up to date: `npm audit`
   - Run `npm audit` regularly
   - Fix vulnerabilities promptly
   - Consider using Dependabot for automated updates
6. **Secrets** - Rotate API keys and secrets regularly
   - Rotate OAuth client secrets periodically
   - Use different secrets for development and production
   - Never hardcode secrets in source code
7. **Rate Limiting** - API routes are protected with rate limiting
   - Review rate limit configurations for your use case
   - Monitor for abuse patterns
8. **Input Validation** - Validate all user inputs
   - Sanitize user inputs to prevent XSS
   - Validate file uploads (type, size)
   - Use parameterized queries (Firestore handles this)

## Pre-Publication Security Checklist

**⚠️ CRITICAL: Before making this repository public, you MUST verify that no secrets have been committed to git history.**

### Why This Matters

Simply removing a file with secrets in a new commit is **NOT sufficient**. The secrets remain in the git history and can be accessed by anyone who clones the repository. Once a repository is public, exposed secrets can be discovered and exploited.

### How to Check Git History

1. **Search for common secret patterns:**
   ```bash
   # Search for API keys, tokens, and secrets in git history
   git log --all --full-history --source -- "*" | grep -i -E "(api[_-]?key|secret|password|token|private[_-]?key|client[_-]?secret|auth[_-]?token)"
   ```

2. **Check for environment files that may have been committed:**
   ```bash
   # Check if .env files were ever committed
   git log --all --full-history --source -- ".env*"
   ```

3. **Review recent commits for sensitive data:**
   ```bash
   # Review commits that modified files likely to contain secrets
   git log --all --full-history --source -- "*.env*" "*.config*" "*.json" "*.ts" "*.tsx"
   ```

### If Secrets Are Found in History

If you discover that secrets were previously committed, you **MUST** scrub them from git history before making the repository public. Use one of these tools:

#### Option 1: BFG Repo-Cleaner (Recommended)

1. Install BFG: `brew install bfg` (macOS) or download from [rtyley/bfg-repo-cleaner](https://github.com/rtyley/bfg-repo-cleaner)

2. Create a file listing secrets to remove:
   ```bash
   echo "your-actual-secret-value" > secrets.txt
   ```

3. Remove secrets from history:
   ```bash
   bfg --replace-text secrets.txt
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```

4. Force push (⚠️ **WARNING**: This rewrites history):
   ```bash
   git push --force --all
   ```

#### Option 2: git-filter-repo

1. Install git-filter-repo: `pip install git-filter-repo`

2. Remove specific files or patterns:
   ```bash
   git filter-repo --path .env.local --invert-paths
   # Or remove specific content
   git filter-repo --replace-text <(echo "old-secret==>new-placeholder")
   ```

3. Force push (⚠️ **WARNING**: This rewrites history):
   ```bash
   git push --force --all
   ```

### After Scrubbing History

1. **Verify the secrets are gone:**
   ```bash
   git log --all --full-history --source -- "*" | grep -i "your-secret"
   # Should return no results
   ```

2. **Rotate all exposed secrets immediately:**
   - Generate new API keys
   - Create new OAuth client secrets
   - Update all services using the old secrets

3. **Notify team members:**
   - Anyone who cloned the repository before scrubbing will still have the secrets in their local history
   - They should delete their local clone and re-clone after the history is scrubbed

### Prevention

To prevent this in the future:

- Always verify `.gitignore` includes `.env*` files
- Use `git status` before committing to ensure no sensitive files are staged
- Consider using tools like [git-secrets](https://github.com/awslabs/git-secrets) or [truffleHog](https://github.com/trufflesecurity/trufflehog) to scan for secrets
- Use pre-commit hooks to prevent committing secrets (see `.husky/pre-commit`)

## Known Security Considerations

- Firebase API keys are public by design (they're client-side)
- Firestore Security Rules are the primary security mechanism
- Server-side secrets (Discord client secret) must remain private
- Email addresses in code are contact info, not secrets

Thank you for helping keep Cursor Boston secure!
