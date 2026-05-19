# Governance

This document describes the governance model for the Cursor Boston project.

## Overview

Cursor Boston is a community-led, open source project. We aim to make decisions transparently and collaboratively, while maintaining clear leadership to ensure the project's health and direction.

## Roles and Responsibilities

### Users

Users are community members who use Cursor Boston. Anyone can be a user; there are no special requirements.

Users may:
- Attend events and participate in the community
- Use the platform and its features
- Report bugs and request features
- Participate in discussions

### Contributors

Contributors are community members who contribute to the project in some way. Anyone can become a contributor by:

- Submitting pull requests
- Filing or commenting on issues
- Improving documentation
- Helping other users
- Participating in discussions
- Organizing or speaking at events

Contributors are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md) and [Contributing Guidelines](CONTRIBUTING.md).

### Maintainers

Maintainers are contributors who have demonstrated a sustained commitment to the project. They have write access to the repository and are responsible for:

- Reviewing and merging pull requests
- Triaging issues and assigning labels
- Guiding the project's technical direction
- Mentoring new contributors
- Ensuring code quality and consistency
- Enforcing the Code of Conduct

**Current Maintainers:** the canonical roster — including names, GitHub handles, role tier, and per-area ownership — lives in [`MAINTAINERS.md`](../MAINTAINERS.md). This document describes the *rules* maintainers operate under; the roster file describes *who* the maintainers are at any given moment.

#### Contributor ladder

The promotion path from first contribution to maintainer responsibility. Modeled on [kubernetes/community community-membership.md](https://github.com/kubernetes/community/blob/master/community-membership.md) with project-scale adjustments.

| Level | Capabilities | Requirements to enter | Sponsor | Granted by |
|---|---|---|---|---|
| **Contributor** | Open PRs, file issues, participate in discussions | Open ≥1 PR or issue. Automatic. | n/a | — |
| **Reviewer** | Trusted to review PRs in an area, but not to merge. Listed in `CODEOWNERS` for that area. | ≥5 merged PRs in the area over ≥30 days; CoC compliance; code-review judgment demonstrated in PR comments | 1 maintainer in the area | Maintainer consensus + Project Lead approval |
| **Maintainer** | Merge PRs, triage issues, set technical direction in their area. Repo write access. | Active as Reviewer for ≥3 months; sustained code-review activity; CoC compliance; area expertise; bus-factor relief (each new maintainer must reduce single-point dependence somewhere) | 2 maintainers | Maintainer consensus + Project Lead approval |
| **Community Maintainer** | Same merge rights as Maintainer; expected to focus on welcoming, contributor support, and external-facing surfaces rather than deep code review on `lib/` or `app/api/` | Active contribution to community surface (docs, events, organizing, partner pages) for ≥3 months; CoC compliance | 1 maintainer | Maintainer consensus + Project Lead approval |
| **Project Lead** | Final decision authority; one seat. | Documented succession (current Project Lead names a successor publicly) | n/a | Outgoing Project Lead, ratified by maintainer consensus |

**Promotion happens at a regular cadence** — not on demand. Quarterly (Jan, Apr, Jul, Oct) the maintainer team reviews who has met the next-level criteria and makes promotion decisions. Self-nomination is encouraged and follows Path B below; nomination by an existing maintainer follows Path A.

**Demotion / step-down** is graceful — see "Step down gracefully" in Maintainer Responsibilities below. A maintainer who has been inactive for ≥6 months is moved to **Maintainer Emeritus** (no merge rights, retained recognition) at the next quarterly review unless they ask to stay. The emeritus list lives in [`MAINTAINERS.md`](../MAINTAINERS.md#emeritus).

**Succession plan for the Project Lead role:**

1. The Project Lead names a designated successor in [`MAINTAINERS.md`](../MAINTAINERS.md) (currently: vacant — to be filled).
2. If the Project Lead becomes unreachable for >30 days without prior notice:
   - The maintainer team takes over decisions by consensus.
   - The maintainer team selects an Acting Project Lead within 14 days.
   - Repo admin / secrets / external accounts (Discord, GitHub Sponsorship, domain registrar) are transferred to the Acting Project Lead via the access path documented in `docs/SECURITY_OPERATIONS.md` (planned).
3. The Acting Project Lead serves until the original Project Lead returns or until a new Project Lead is ratified by maintainer consensus at the next quarterly review.

#### Becoming a Maintainer

Contributors may become maintainers based on:

- Sustained, high-quality contributions over time
- Deep understanding of the codebase and architecture
- Demonstrated ability to review code constructively
- Commitment to the project's mission and values
- Positive interactions with the community

There are **two paths** to becoming a maintainer. The evaluation criteria above are the same for both.

##### Path A — Nomination

1. An existing maintainer nominates a contributor
2. Maintainers discuss the nomination privately
3. Decision is made by consensus among maintainers
4. If approved, the contributor is invited to become a maintainer

##### Path B — Self-nomination (expressing interest publicly)

We don't want the maintainer seat to depend on being noticed. Contributors who are interested in the role can put themselves forward:

1. Open a pull request against the **[`maintainer-application`](https://github.com/rogerSuperBuilderAlpha/cursor-boston/tree/maintainer-application)** branch using the [Maintainer Application Template](MAINTAINER_APPLICATION_TEMPLATE.md). The PR body fills out the template (background, contribution history, areas of interest, time commitment).
2. Maintainers review the application using the same criteria as Path A.
3. If accepted, the application PR is merged and the contributor is invited to become a maintainer.
4. If declined or deferred, the maintainer team responds in the PR with feedback and (where applicable) what additional contribution would change the outcome.

The two paths converge on the same decision rule: consensus among maintainers, with the Project Lead approving.

#### Maintainer Responsibilities

Maintainers are expected to:

- Respond to issues and PRs in a timely manner (within 1 week)
- Review code thoughtfully and constructively
- Help onboard new contributors
- Participate in project discussions and decisions
- Uphold the Code of Conduct
- Step down gracefully if unable to fulfill responsibilities

### Project Lead

The Project Lead provides overall direction and has final decision-making authority when consensus cannot be reached. The Project Lead is responsible for:

- Setting the project's strategic direction
- Resolving disputes that cannot be settled by consensus
- Managing the project's public presence
- Coordinating with external partners and sponsors
- Ensuring the project's long-term sustainability

**Current Project Lead:** [@rogerSuperBuilderAlpha](https://github.com/rogerSuperBuilderAlpha)

## Decision Making

### Consensus-Based Decisions

Most decisions are made through consensus among maintainers. This includes:

- Feature additions and removals
- Architectural changes
- Policy updates
- Release schedules

The process:
1. A proposal is made via GitHub issue (or raised on Discord and summarized in an issue)
2. Maintainers and community members provide feedback
3. The proposal is refined based on feedback
4. When there are no unresolved objections, the proposal is accepted

### Voting

For decisions where consensus cannot be reached:

1. Any maintainer may call for a vote
2. The vote is conducted via GitHub issue or private maintainer channel
3. Each maintainer has one vote
4. Decisions require a simple majority
5. The Project Lead may break ties

### Emergency Decisions

In urgent situations (security vulnerabilities, Code of Conduct violations, critical bugs), maintainers may act without full consensus:

1. Any maintainer may take immediate action
2. The action is documented and communicated to other maintainers
3. The decision is reviewed at the next opportunity
4. If contested, normal decision-making processes apply

## Code Review

All code changes require review before merging.

### Tiers

- **Minor changes** (typos, docs-only edits, dependency bumps with no changelog impact, generated-file refreshes, badge/README link tweaks): **One maintainer approval**. No waiting period.
- **Standard changes** (features, bug fixes, non-trivial refactors, any change touching `lib/`, `app/api/`, `config/`, or workflows): **Two maintainer approvals**, 24-hour waiting period for objections.
- **Major changes** (architecture changes, breaking changes, governance edits, security-policy edits): **Two maintainer approvals**, 72-hour waiting period.

The 2-reviewer requirement on Standard and Major changes is enforced at the GitHub level via branch protection on `develop` and `main` (`required_approving_review_count: 2`). See [`docs/BRANCH_PROTECTION.md`](../docs/BRANCH_PROTECTION.md) for the live settings and OpenSSF Best Practices Gold criterion `two_person_review` for the rationale.

### No self-approval

The author of a PR cannot approve their own changes. A maintainer may merge their own PR **only after** the required number of other maintainer "Approve" reviews have landed. This rule applies to every PR, including governance/docs PRs and including the Project Lead.

This is enforced both procedurally (maintainers are expected to follow it) and observably (GitHub's review history on each PR is the audit trail).

### Project Lead bypass

The Project Lead may use `gh pr merge --admin` to bypass the 2-reviewer requirement in two narrow cases:

1. **Develop → main release PRs** — `--admin` is the documented mechanism to bypass DCO failures and the `mergeStateStatus=BEHIND` topology quirk that affects rebase-style releases.
2. **Urgent production fixes** — security patches or live-incident hotfixes when a second reviewer is not reachable within the window the incident allows.

Every bypass is audit-trail-visible in the GitHub merge metadata (the API records which user merged with admin privileges). Bypasses MUST be:

- Linked in `#maintainers` on Discord within 24 hours with the reason.
- Reviewed retroactively by a second maintainer within 7 days; any issues found are fixed via a follow-up PR.

The bypass exists so the policy never blocks a security fix or a clean release, not as a routine path for feature work.

### Exception: solo-emergency merges (legacy alias)

The "solo-emergency merge" terminology previously documented in this section is now covered by the Project Lead bypass clause above. The mechanics are the same: emergency merge, link in `#maintainers` within 24 hours, retroactive second review within 7 days.

## Releases

Releases follow [Semantic Versioning](https://semver.org/):

- **Patch releases** (x.x.X): Bug fixes, no new features
- **Minor releases** (x.X.0): New features, backwards compatible
- **Major releases** (X.0.0): Breaking changes

Any maintainer may initiate a release following the documented release process.

## Conflict Resolution

### Technical Disputes

1. Discuss in the relevant GitHub issue or PR
2. If unresolved, escalate to a separate discussion thread
3. Maintainers attempt to reach consensus
4. If consensus fails, the Project Lead makes the final decision

### Code of Conduct Violations

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for the enforcement process.

### Maintainer Disputes

1. Attempt to resolve privately between involved parties
2. If unresolved, involve other maintainers as mediators
3. If still unresolved, the Project Lead makes the final decision

## Changes to Governance

Changes to this governance document require:

1. A pull request with the proposed changes
2. A 7-day comment period
3. Approval from a majority of maintainers
4. Final approval from the Project Lead

## Contact

- **General questions:** hello@cursorboston.com
- **Security issues:** See [SECURITY.md](SECURITY.md)
- **Code of Conduct issues:** hello@cursorboston.com

---

This governance model is inspired by open source best practices and may evolve as the project and community grow.
