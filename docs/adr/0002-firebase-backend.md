# ADR-0002: Firebase as backend platform

**Status:** Accepted
**Date:** 2026-01-27
**Authors:** @rogerSuperBuilderAlpha

## Context

The platform needs authentication, a document database, and file storage. As a community-led open source project, we needed a backend that:

- Has a generous free tier so contributors can run a local dev environment at zero cost.
- Requires no server infrastructure to manage (the maintainer team is small).
- Provides built-in auth with social providers (Google, GitHub, Discord).
- Has well-documented SDKs that beginners can learn quickly.

Alternatives considered:

| Option | Pros | Cons |
|--------|------|------|
| Supabase (Postgres) | SQL, open source server | Self-hosting complexity, smaller ecosystem at the time |
| PlanetScale / Neon | Serverless SQL | No built-in auth, need separate file storage |
| MongoDB Atlas | Document model | No built-in auth, separate services needed |
| Firebase | Auth + Firestore + Storage in one | Vendor lock-in, NoSQL limitations |

## Decision

Use **Firebase** (Auth, Cloud Firestore, Cloud Storage) as the backend platform.

- Firebase Auth handles email/password, Google, and GitHub sign-in.
- Firestore serves as the primary database (users, events, posts, teams).
- Cloud Storage handles avatar uploads and other files.
- Firestore Security Rules are the primary authorization layer, tested via emulator in CI.
- Firebase Admin SDK is used in API routes for privileged operations.

## Consequences

- **Fast onboarding:** Contributors need only a Firebase project and a `.env.local` file to run the full stack locally. The emulator suite allows offline development.
- **Vendor lock-in:** Firestore queries, security rules, and the Admin SDK are Firebase-specific. Migrating away would require rewriting the data layer. This is acceptable given the project's scope.
- **NoSQL trade-offs:** Complex relational queries (e.g., "all events attended by members of team X") require denormalization or multiple reads. We accept this for the simpler document model.
- **Security rules as authorization:** Firestore rules are the real access control, not API middleware. This means rules must be thoroughly tested — we run emulator-based rule tests in CI.
- **Cost at scale:** Firebase pricing is per-read/write. For a community site with moderate traffic this is effectively free, but would need review if usage spikes.
