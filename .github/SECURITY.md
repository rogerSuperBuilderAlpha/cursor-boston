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

Preferred options (pick one):

1. **GitHub private vulnerability reporting** (recommended) — use the **Report a vulnerability** link on the [**Security** tab](https://github.com/rogerSuperBuilderAlpha/cursor-boston/security/advisories/new). This opens a private thread visible to every maintainer and is the fastest path to a fix. It does not depend on email forwarding being configured.
2. **Email:** **security@cursorboston.com** (forwards to the maintainer team).
3. **Fallback:** if you don't get an acknowledgement within 48 hours via either channel, please email **hello@cursorboston.com** with the subject line beginning `[security]` so it lands in the same triage queue used by the rest of the maintainer team. This fallback exists so a misrouted security@ message never delays a disclosure.

For machine-readable disclosure routing, see [`public/.well-known/security.txt`](../public/.well-known/security.txt) (served at `https://cursorboston.com/.well-known/security.txt` in production).

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
   - Use `.env.local.example` as a template (or `.env.local.demo` for zero-config demo mode)
   - Set production environment variables in your deployment platform
   - See [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md) for local setup instructions
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
   - For the project's own rotation cadence and runbook, see [`docs/SECURITY_OPERATIONS.md`](../docs/SECURITY_OPERATIONS.md)
7. **Rate Limiting** - API routes are protected with rate limiting
   - Review rate limit configurations for your use case
   - Monitor for abuse patterns
8. **Input Validation** - Validate all user inputs
   - Sanitize user inputs to prevent XSS
   - Validate file uploads (type, size)
   - Use parameterized queries (Firestore handles this)

## Release integrity

- **Signed releases** — every release after v0.2.2 ships Sigstore-signed SBOMs (`sbom.json.cosign.bundle`, `sbom.spdx.json.cosign.bundle`) and a SLSA L2 build provenance attestation. Verify with [cosign](https://github.com/sigstore/cosign).
- **Signed tags** — release tags from v0.3.0 forward are signed with gitsign or GPG. The release workflow refuses to publish unsigned tags. See [`docs/RELEASING.md` § Signed tags](../docs/RELEASING.md#signed-tags) for verification commands.
- **Branch protection** — `main` and `develop` require PR + review + status checks; `main` additionally enforces `enforce_admins`.

## Preventing Accidental Secret Exposure

To prevent security issues:

- Always verify `.gitignore` includes `.env*` files
- Use `git status` before committing to ensure no sensitive files are staged
- Consider using tools like [git-secrets](https://github.com/awslabs/git-secrets) or [truffleHog](https://github.com/trufflesecurity/trufflehog) to scan for secrets
- Use pre-commit hooks to prevent committing secrets (see [docs/DEVELOPMENT.md - Pre-commit Hooks](../docs/DEVELOPMENT.md#pre-commit-hooks))

## Known Security Considerations

- Firebase API keys are public by design (they're client-side)
- Firestore Security Rules are the primary security mechanism
- Server-side secrets (Discord client secret) must remain private
- Email addresses in code are contact info, not secrets

Thank you for helping keep Cursor Boston secure!
