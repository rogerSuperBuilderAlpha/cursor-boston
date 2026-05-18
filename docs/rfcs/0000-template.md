---
rfc: 0000
title: Short descriptive title
author: your-github-handle
status: draft
opened: YYYY-MM-DD
---

# RFC-0000: Short descriptive title

## Summary

One paragraph. What is the proposal, and what changes for users / contributors when it lands?

## Motivation

Why are we doing this? What's the problem we're solving? Be specific about the cost of *not* doing it. A motivation section that boils down to "it would be nice to have X" is usually a sign the proposal needs more concrete justification.

If there's a relevant incident, metric, or user feedback, link it.

## Detailed design

The bulk of the RFC. Describe the proposed change in enough detail that someone other than the author could implement it. Include:

- New types / interfaces / API contracts (with code snippets if useful)
- New routes / pages / Firestore collections
- New external dependencies (and why the existing options don't fit)
- Migration path from the current state, if applicable
- How the change interacts with existing subsystems (cross-link to [`../ARCHITECTURE.md`](../ARCHITECTURE.md))

Be specific. "We'll add a generic logging interface" is not specific. "We'll add `lib/logger.ts` exporting `logger.info`, `logger.warn`, `logger.error` that route to Sentry breadcrumbs in production and `console.*` in dev" is specific.

## Drawbacks

What's the cost of this proposal? Be honest. Every architectural choice closes doors as well as opens them.

Candidate drawbacks to consider:
- Maintenance burden of the new surface
- New external dependency / vendor lock-in
- Performance impact
- Migration cost for existing users / data
- Onboarding burden for new contributors (one more concept to learn)

## Alternatives

What other approaches did you consider? Why didn't you propose them?

This section is the highest-leverage part of the RFC for future maintainers — it shows that you understood the design space, and it gives reviewers a chance to push back on choices.

Cover at least:
- "Do nothing" — what happens if we don't do this?
- One realistic alternative — a different approach that solves the same problem
- (If applicable) what the prior art is in other comparable projects

## Unresolved questions

What's still open at the time of writing? Listing these explicitly helps reviewers focus on the right places.

It's fine to leave these open during the discussion period — they should resolve before the RFC is accepted, but they can resolve through the discussion itself.

## Future possibilities

What does this proposal enable that's outside its current scope? Briefly. Don't scope-creep — but note where the work goes if accepted.

---

## Implementation checklist (filled in after acceptance)

- [ ] Tracking issue opened
- [ ] Implementation PR(s):
  - [ ] PR #
- [ ] CHANGELOG entry added
- [ ] Corresponding ADR written in [`../adr/`](../adr/README.md)
- [ ] Cross-linked from this RFC's frontmatter (`implemented:` + `adr:`)
- [ ] User-facing docs updated (if applicable)
