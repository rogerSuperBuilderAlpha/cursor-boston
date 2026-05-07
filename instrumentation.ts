/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Next.js 16 instrumentation hook.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Runs once per server boot. We use it to initialize Sentry conditionally:
 *   - Only when `SENTRY_DSN` is set (so dev / preview / unconfigured
 *     environments stay zero-overhead).
 *   - Only when `@sentry/nextjs` is actually installed (the dynamic
 *     import returns null otherwise — tested in `lib/logger.ts`).
 *
 * To activate Sentry:
 *   1. `npm install @sentry/nextjs`
 *   2. Set `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (client)
 *      via Vercel env or `.env.local`.
 *   3. Optionally run `npx @sentry/wizard@latest -i nextjs` to wire up
 *      source maps, but the runtime captures already work without it.
 *
 * See `docs/DEVELOPMENT.md` § "Errors and observability".
 */

export async function register() {
  if (!process.env.SENTRY_DSN) return;

  try {
    const sentryMod: unknown = await import(
      /* @vite-ignore */ /* webpackIgnore: true */ "@sentry/nextjs"
    ).catch(() => null);
    const init = (sentryMod as {
      init?: (opts: Record<string, unknown>) => void;
    } | null)?.init;
    if (typeof init !== "function") return;

    init({
      dsn: process.env.SENTRY_DSN,
      // Lower default sample rates than Sentry's defaults — this is a
      // community platform, not an SLO-critical service. Bump in env.
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
      // PII in payloads: never. Server-side message scrubbing in
      // `lib/logger.ts` already handles error messages; this disables
      // Sentry's automatic capture of request bodies, cookies, headers.
      sendDefaultPii: false,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      release: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
    });
  } catch {
    // Never block server boot on observability wiring.
  }
}
