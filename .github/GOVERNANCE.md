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

- **Minor changes** (typos, docs, small fixes): One maintainer approval.
- **Standard changes** (features, bug fixes): One maintainer approval, 24-hour waiting period for objections.
- **Major changes** (architecture, breaking changes): Two maintainer approvals, 72-hour waiting period.

### No self-approval

The author of a PR cannot approve their own changes. A maintainer may merge their own PR **only after** another maintainer has submitted a GitHub "Approve" review on that PR. This rule applies to every PR, including governance/docs PRs and including the Project Lead.

This is enforced procedurally (maintainers are expected to follow it) and observably (GitHub's review history on each PR is the audit trail). If the maintainer team observes that the rule is being skipped in practice, the next governance update should move enforcement to a required-status-check on the branch protection rules.

### Exception: solo-emergency merges

If only one maintainer is reachable and the change is urgent (security patch, production outage), that maintainer may merge without a second reviewer. The merged PR must then be:

1. Linked in `#maintainers` on Discord with the reason for the exception.
2. Reviewed retroactively by a second maintainer within 7 days; any issues found are fixed via a follow-up PR.

This exception exists so the rule never blocks a security fix, not as a routine path.

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
