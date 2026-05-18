# Request for Comments (RFCs)

Substantial changes to Cursor Boston should be proposed as **RFCs** (Requests for Comments) before significant code lands. This folder collects active and historical RFCs.

> **RFCs are forward-looking.** They propose a change that hasn't shipped yet, and they're refined publicly before implementation begins. Compare to **ADRs** in [`../adr/`](../adr/README.md), which record decisions *after the fact* — once an ADR is written, the choice is settled. RFCs become ADRs after they merge and the work ships.

This process is adapted from the [Rust RFC process](https://rust-lang.github.io/rfcs/) and [React RFCs](https://github.com/reactjs/rfcs).

---

## When to write an RFC

Open an RFC for any change that meets at least one of these:

- A new core API surface or subsystem (e.g., new top-level route tree, new external integration, new data model).
- A major refactor that touches >10 files or affects multiple subsystems.
- A change to a public contract (API schema, URL structure, Firestore rules surface).
- A change to governance, code-of-conduct enforcement, or release process.
- Adopting a new external dependency that becomes load-bearing (observability platform, payment provider, CDN provider, etc.).
- Anything you've heard >1 maintainer disagree about. The disagreement itself is the signal.

**Don't open an RFC for:**

- Bug fixes (use an issue or just open the PR).
- Adding a unit, spell, hero, or balance change to Generals — use the [game design proposal issue template](../../.github/ISSUE_TEMPLATE/3-game-design-proposal.yml).
- Documentation improvements (use a PR).
- New API routes that fit an existing subsystem and an existing contract pattern.
- Refactors with a small blast radius.

When in doubt, ask in `#maintainers` on Discord — it's cheaper than going through the full RFC process for something that doesn't need it.

## The process

1. **Draft an RFC.** Copy [`0000-template.md`](0000-template.md) to a new file named `NNNN-short-description.md`, picking the next available number. (Don't number-jump; the next available number wins even if your RFC ends up larger than someone else's.)
2. **Open a pull request** against `develop` adding your draft. Title: `RFC-NNNN: <Short description>`. Body: link to the RFC file + a 2-sentence summary.
3. **Discussion period.** RFCs stay open for at least **7 days** to give the community time to read and comment. Substantial RFCs (new subsystem, governance change) stay open for **14 days minimum**.
4. **Iteration.** Update the RFC based on feedback. Use commits, not force-pushes, so reviewers can see the diff.
5. **Decision.** After the discussion period:
   - **Accept** — maintainer consensus + Project Lead approval. The PR merges; the RFC is now "accepted but not yet implemented".
   - **Reject** — close the PR with a written reason in the closing comment, and (if useful) a "what would change my mind" note for future submitters.
   - **Postpone** — keep the PR open but labeled `rfc/postponed`; revisit at the next quarterly maintainer review.
6. **Implementation.** A separate implementation PR (or PRs) lands. Each PR references the RFC number in its description.
7. **Conversion to ADR.** Once the work ships, the implementation PR or a follow-up PR adds a corresponding ADR under [`../adr/`](../adr/README.md), referencing the RFC. The RFC stays in this folder as the historical proposal; the ADR is the canonical record of the decision.

## RFC states

| State | Meaning |
|---|---|
| Draft | Open PR; under discussion |
| Accepted | Merged into the repo; implementation may not have started |
| Implemented | Has a corresponding ADR; the work has shipped |
| Rejected | Closed PR; the closing comment records why |
| Postponed | Open PR with `rfc/postponed` label; pending future review |
| Withdrawn | Closed by the author |
| Superseded | Replaced by a later RFC; cross-link in the frontmatter |

## File format

Every RFC starts with frontmatter:

```yaml
---
rfc: NNNN
title: Short descriptive title
author: github-handle
status: draft | accepted | implemented | rejected | postponed | withdrawn | superseded
opened: YYYY-MM-DD
merged: YYYY-MM-DD     # if accepted
implemented: YYYY-MM-DD  # if shipped — also link the ADR
supersedes: NNNN  # if applicable
superseded_by: NNNN  # if applicable
---
```

The body follows the template structure: Summary, Motivation, Detailed design, Drawbacks, Alternatives, Unresolved questions.

## Index of RFCs

| # | Title | Status | Opened | Merged | ADR |
|---|---|---|---|---|---|
| _none yet_ | _The first RFC will be RFC-0001 (Sentry adoption + structured logging contract — see [REVIEW_ACTION_PLAN.md §5.2.4](../REVIEW_ACTION_PLAN.md))._ | | | | |

## Why RFCs in addition to ADRs?

ADRs are an excellent forensic record of *why we did X*. They're written after the fact, when the decision is fresh and the implementation is in hand. But they don't surface the decision *before* it's made — which means the community can't participate in shaping it.

RFCs fill that gap. They make decisions discoverable and discussable while they're still cheap to change. Once the work ships, the RFC stays as the historical proposal; the ADR is the canonical record. Both have value; they're not redundant.

## Why not just a GitHub issue?

Issues are good for problem statements ("this is broken / this is missing") and small features. RFCs are for proposals that need a written design — the kind of thing where the discussion would otherwise spread across 30 issue comments and never be findable later.

RFCs live in the repo (not in Issues) for two reasons:

1. They're version-controlled. Edits are tracked. Anyone can see what changed between iterations.
2. They're permanent. An issue can be deleted; a merged RFC is in `git log` forever.

---

_RFC process bootstrapped 2026-05-18 per [REVIEW_ACTION_PLAN.md §5.2.4](../REVIEW_ACTION_PLAN.md). Update this README when the process itself changes._
