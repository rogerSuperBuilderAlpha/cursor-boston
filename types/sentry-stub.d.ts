/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Stub declaration for `@sentry/nextjs`.
 *
 * The package is OPTIONAL — `lib/logger.ts` and `instrumentation.ts`
 * both use dynamic imports gated on `SENTRY_DSN` and gracefully
 * skip when the module fails to resolve. This stub lets TypeScript
 * compile without the package installed; once a contributor runs
 * `npm install @sentry/nextjs`, the real types take over.
 *
 * See `docs/DEVELOPMENT.md` § "Errors and observability".
 */
declare module "@sentry/nextjs";
