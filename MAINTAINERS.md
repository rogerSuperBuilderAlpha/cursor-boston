# Maintainers

## Current maintainers

| Name | GitHub | Role | Since |
|------|--------|------|-------|
| Roger Hunt      | [@rogerSuperBuilderAlpha](https://github.com/rogerSuperBuilderAlpha) | Project Lead | 2026-01-27 |
| Brad Egan       | [@bradAGI](https://github.com/bradAGI) | Maintainer | 2026-05-13 |
| Neha Chaudhari  | [@nebullii](https://github.com/nebullii) | Maintainer | 2026-05-13 |
| Aaron Grace     | [@AaronGrace978](https://github.com/AaronGrace978) | Community Maintainer | 2026-05-13 |

The full role definitions, decision-making process, and code-review tiers live in [`.github/GOVERNANCE.md`](.github/GOVERNANCE.md).

## Becoming a maintainer

Two paths, both documented in [GOVERNANCE.md](.github/GOVERNANCE.md#becoming-a-maintainer):

1. **Nomination** — an existing maintainer nominates a contributor based on sustained, high-quality contributions. This path has always existed.
2. **Self-nomination via application** — open a PR against the [`maintainer-application`](https://github.com/rogerSuperBuilderAlpha/cursor-boston/tree/maintainer-application) branch using the [Maintainer Application Template](.github/MAINTAINER_APPLICATION_TEMPLATE.md). The existing maintainer-team review process then runs against your application.

Both paths use the same evaluation criteria (sustained contributions, code-review judgment, community fit) and the same decision rule (consensus among maintainers, Project Lead approves).

## CODEOWNERS and area ownership

[`.github/CODEOWNERS`](.github/CODEOWNERS) lists all four maintainers as default owners. Per-area primaries:

- **Brad** — test surface (`__tests__/`, `e2e/`), CI/release workflows (`.github/workflows/`), and security-adjacent middleware (`lib/middleware.ts`, `lib/sanitize.ts`, rate-limit modules) — the areas he established expertise in through the test-coverage and security-hardening work that preceded his application.
- **Neha** — analytics dashboard (`app/analytics/`, `app/api/analytics/`), realtime lightning-talk sessions (`app/live/`, `app/api/live/`, `lib/live-sessions/`), and the feed/map UI components — the two feature projects she shipped (#155, #213) plus the UI surface she's iterated on.
- **Aaron** — community/marketing-facing surface: the footer (`components/Footer.tsx` — which he shipped in #506), partner-facing pages (`app/partners/`), and the welcoming-tier docs (`docs/GET_STARTED.md`, `docs/FIRST_CONTRIBUTION.md`) — aligned with his self-described CMO-style role. Default reviewer everywhere else; expects to develop additional primary areas in the role.
- **Roger** — governance docs (MAINTAINERS.md, GOVERNANCE.md, CODEOWNERS), and the game subsystem.

### Community Maintainer track

Aaron holds the **Community Maintainer** title rather than the standard Maintainer title — a track for maintainers whose value to the project is principally in welcoming, contributor support, and external-facing surface rather than deep code review. The decision-making weight is the same (one maintainer = one approval), but the expected day-to-day differs: triage and contributor-support questions, marketing-adjacent docs, and the welcoming pages, rather than deep code review on `lib/` or `app/api/`. The track may evolve into a standard Maintainer role as the codebase familiarity grows.

## Day-to-day

- [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) — fork workflow, `develop` / `main`, DCO, submission-branch routing
- [`docs/RELEASING.md`](docs/RELEASING.md) — tag-driven releases, GitHub Releases, release PRs
- [`docs/SUBMISSION_BRANCHES.md`](docs/SUBMISSION_BRANCHES.md) — what the persistent contribution branches are and when they're used
- [`ROADMAP.md`](ROADMAP.md) — current roadmap and where to file new issues (mirrored at `.github/ACTIVE_ISSUES.md`)

## Emeritus

Maintainers who have stepped down but whose contributions are recognized. None currently.

_When a maintainer steps down (graceful step-down per [GOVERNANCE.md](.github/GOVERNANCE.md), or 6+ months of inactivity at a quarterly review), they're moved here with the date they joined and the date they stepped down. The emeritus role retains community recognition but no merge rights._

## Project Lead succession

Current Project Lead: **Roger Hunt** ([@rogerSuperBuilderAlpha](https://github.com/rogerSuperBuilderAlpha)).

Designated successor: _vacant — to be filled at the 2026-Q3 quarterly review._

The succession process is documented in [`.github/GOVERNANCE.md`](.github/GOVERNANCE.md) § Contributor ladder → Succession plan for the Project Lead role. In short: if the Project Lead becomes unreachable for >30 days without prior notice, the maintainer team takes over by consensus and selects an Acting Project Lead within 14 days.
