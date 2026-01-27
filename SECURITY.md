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
2. **Firebase Security Rules** - Review and customize Firestore and Storage rules
3. **Authentication** - Use strong authentication methods
4. **HTTPS** - Always use HTTPS in production
5. **Dependencies** - Keep dependencies up to date: `npm audit`
6. **Secrets** - Rotate API keys and secrets regularly

## Known Security Considerations

- Firebase API keys are public by design (they're client-side)
- Firestore Security Rules are the primary security mechanism
- Server-side secrets (Discord client secret) must remain private
- Email addresses in code are contact info, not secrets

Thank you for helping keep Cursor Boston secure!
