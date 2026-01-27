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

## Security Best Practices

To prevent security issues:

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
