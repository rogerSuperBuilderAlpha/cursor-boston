# ADR-0005: In-memory rate limiting with Firestore fallback

**Status:** Accepted
**Date:** 2026-04-13
**Authors:** @rogerSuperBuilderAlpha

## Context

The platform exposes 50+ API routes that need rate limiting to prevent abuse. The project is deployed on Vercel serverless functions, where each invocation may run in a different isolate, making pure in-memory state unreliable for distributed enforcement. However, the project is a community platform with moderate traffic, not a high-scale SaaS — the threat model is casual abuse, not coordinated attacks.

Alternatives considered:

| Option | Pros | Cons |
|--------|------|------|
| **Redis (e.g., Upstash)** | True distributed state, battle-tested | Monthly cost, extra service to configure, contributors need Redis locally |
| **Firestore-only** | Distributed, already in stack | Transaction latency on every request, read/write cost at scale |
| **In-memory only** | Zero cost, zero setup, fast | Per-isolate on Vercel — limits are not shared across instances |
| **Two-tier (in-memory + Firestore)** | Zero extra infra, distributed when Admin DB is available, graceful fallback | Slightly more complex implementation |

## Decision

Use a **two-tier rate limiting architecture** with no external dependencies beyond Firebase:

1. **Primary layer** (`lib/rate-limit.ts`): An in-memory limiter using a plain JavaScript object. It provides predefined configs (`rateLimitConfigs`) for different endpoint types (OAuth callbacks: 10 req/15 min, standard API: 60/min, webhooks: 30/min, hackathon mutations: 10–40/min, etc.). Automatic cleanup runs every 60 seconds with a 10,000-entry ceiling.

2. **Secondary layer** (`lib/rate-limit-server.ts`): A Firestore-backed distributed limiter that uses transactions on the `apiRateLimits` collection for cross-instance consistency. When the Admin DB is unavailable, it falls back to the in-memory limiter with configurable modes:
   - `strict-memory` (default): tighter in-memory limits as a safety net.
   - `memory`: same limits as the distributed tier.
   - `deny`: fail closed with 503 when the distributed limiter is unavailable.

Both layers return standard `X-RateLimit-*` headers (Limit, Remaining, Reset) and `Retry-After` on denial.

## Consequences

- **Zero infrastructure cost:** No Redis or Upstash bill. The Firestore reads/writes for rate limiting fall within the free tier for moderate traffic.
- **Contributor-friendly:** Local development requires no extra services — the in-memory limiter works standalone.
- **Per-isolate caveat:** On Vercel, in-memory limits are scoped to each serverless isolate. A determined attacker hitting different isolates could exceed intended limits. This is acceptable for the project's threat model; the Firestore tier provides distributed protection for sensitive endpoints.
- **Upgrade path:** If the project scales significantly, replacing the in-memory layer with Upstash Redis would be a targeted change to `lib/rate-limit.ts` without altering the `withRateLimit` / `rateLimitConfigs` API that API routes consume.
- **Observability:** Both layers emit structured `rate_limit_observation` log events with source, scope, and fallback metadata for operational monitoring.
