# Security operations runbook

This page documents **how production secrets are rotated** on Cursor Boston and the related operational practices that aren't already covered by [`.github/SECURITY.md`](../.github/SECURITY.md) (disclosure policy) or [`docs/SUPPLY_CHAIN.md`](SUPPLY_CHAIN.md) (build/release artifacts).

For the project-wide security policy and how to report a vulnerability, see [`.github/SECURITY.md`](../.github/SECURITY.md).

---

## Secret inventory and rotation cadence

All production secrets are stored in **Vercel environment variables** for the production project and (where applicable) **Firebase Functions config**. Nothing here lives in the repo — [`.env.local.example`](../.env.local.example) holds placeholders only.

| Secret | Blast radius if leaked | Rotation cadence | Notes |
|---|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | High — full admin access to Firestore, Auth, Storage | **90 days** + immediately on any suspected compromise | Generated via Firebase Console → Project Settings → Service accounts. Old key must be deleted (not just unrotated) so the JWT can't be replayed. |
| `DISCORD_CLIENT_SECRET` | Medium — OAuth impersonation against the configured Discord application | 180 days | Rotate via Discord Developer Portal → application → OAuth2. |
| `DISCORD_WEBHOOK_URL_PR` | Low — anyone with the URL can post to the configured channel | On compromise only; regenerate the webhook from the Discord channel settings | The URL itself is the secret. |
| `GITHUB_CLIENT_SECRET` | Medium — OAuth impersonation against the GitHub App | 180 days | Rotate via the GitHub App settings → Generate a new client secret. |
| `GITHUB_WEBHOOK_SECRET` | Medium — attacker can forge webhook payloads | 180 days | Rotate via the GitHub App webhook settings; redeploy so the new value is in Vercel env. |
| `CRON_SECRET` | Medium — attacker can trigger cron-protected endpoints (e.g. `/api/rate-limit/cleanup`) | **90 days** | Used by the rate-limit cleanup script and any cron-gated route. |
| `ACCOUNT_PURGE_HMAC_SECRET` | Medium — attacker can forge account-purge authorizations | **90 days** | Used to sign account-deletion requests. Rotating invalidates any pending purge links. |
| `UPSTASH_REDIS_REST_TOKEN` | Medium — full read/write on the distributed rate-limit store | 180 days | Rotate via Upstash console. |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Low — Sentry treats DSNs as semi-public; only impact is event-ingest spoofing | On project rotation only | Not a true secret. |

`NEXT_PUBLIC_*` variables are **not secrets** — they're shipped to the client by design (Firebase web config, Discord/GitHub OAuth client IDs, Sentry DSN). Rotating them requires coordinated frontend redeploys.

### When to rotate immediately

Treat the cadence above as a **maximum**. Rotate any secret immediately if:

- The secret appears in a commit, log, screenshot, or anywhere outside Vercel / Firebase / the dev's local `.env.local`.
- A maintainer with access leaves the project.
- A laptop with `.env.local` is lost or compromised.
- A pre-commit secret scan (`gitleaks`) flags a value that matches one of the patterns above.
- A successful account purge or cron-protected request lands without a paired admin action.

The [April 2026 referral-code incident](security-incident-2026-04-11.md) is the codified precedent for "rotate first, investigate second."

---

## Rotation runbook

For each secret, the steps are the same shape — generate, deploy, invalidate.

1. **Generate** the new value in the upstream provider (Firebase, Discord, GitHub App, Upstash, or `openssl rand -hex 32` for the HMAC/cron secrets).
2. **Deploy** by updating the value in [Vercel project environment variables](https://vercel.com/docs/projects/environment-variables) for the Production environment, then triggering a redeploy.
3. **Invalidate** the old value at the upstream provider (delete the old service-account key, revoke the old OAuth client secret, regenerate the webhook). Do not assume "unset in Vercel" is enough — the old credential must be invalidated at the source.
4. **Verify** by exercising the dependent code path. For example:
   - After `CRON_SECRET` rotation: run `CRON_SECRET=<new> npm run rate-limit-cleanup` against production with `RATE_LIMIT_CLEANUP_DRY_RUN=true`.
   - After `FIREBASE_SERVICE_ACCOUNT_JSON` rotation: exercise an admin-SDK code path (e.g. a server route that reads Firestore using the admin client).
   - After `GITHUB_WEBHOOK_SECRET` rotation: trigger a test webhook from the GitHub App settings.
5. **Log** the rotation in a private maintainer note (date, secret, who rotated). The log isn't published — it just exists so the next rotation cycle starts from a known date.

---

## Branch-protection and admin-bypass policy

Branch protection on `main` and `develop` is documented in [`docs/BRANCH_PROTECTION.md`](BRANCH_PROTECTION.md). Key operational notes:

- **`develop`** is the integration branch — every PR runs CI, DCO, and the security gates.
- **`main`** receives only release PRs from `develop`. Admin-bypass (`gh pr merge --admin`) is used **only** for develop→main release PRs that fail the `mergeStateStatus=BEHIND` topology check, never for normal feature PRs.
- The April 2026 incident involved temporarily disabling branch protection on `main` to force-push the history rewrite from `git filter-repo`. That is the only documented case where main's protection should be disabled, and it's an emergency-only action.

---

## Incident response

When something goes wrong (leaked secret, suspicious access, exploited bug):

1. **Stop the bleeding first.** Rotate the affected secret immediately — do not wait to confirm impact. The cost of rotation is low; the cost of continued exposure is not.
2. **Preserve evidence.** Don't `git filter-repo` or delete logs until the maintainer team has captured what happened.
3. **Publish a post-mortem** under `docs/security-incident-YYYY-MM-DD.md` once the immediate response is complete. The [April 2026 referral-code postmortem](security-incident-2026-04-11.md) is the template.
4. **Codify the lesson.** Every published postmortem must end with a concrete prevention change — a gitleaks rule, a `.gitignore` pattern, a CI gate, or a runbook update. A postmortem without a code-side change is incomplete.

---

## Related docs

- [`.github/SECURITY.md`](../.github/SECURITY.md) — disclosure policy and reporting channels
- [`docs/SUPPLY_CHAIN.md`](SUPPLY_CHAIN.md) — release artifact signing, SBOMs, dependency review
- [`docs/BRANCH_PROTECTION.md`](BRANCH_PROTECTION.md) — branch-protection settings on `main` and `develop`
- [`docs/security-incident-2026-04-11.md`](security-incident-2026-04-11.md) — April 2026 referral-code exposure postmortem
- [`.gitleaks.toml`](../.gitleaks.toml) — current secret-scanning rules
