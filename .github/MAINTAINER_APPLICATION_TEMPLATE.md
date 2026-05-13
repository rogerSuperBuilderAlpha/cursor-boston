# Maintainer Application Template

This template is for contributors who want to **self-nominate** for a maintainer role on Cursor Boston (Path B in [GOVERNANCE.md](GOVERNANCE.md#becoming-a-maintainer)).

## How to use this template

1. Open a pull request against the **[`maintainer-application`](https://github.com/rogerSuperBuilderAlpha/cursor-boston/tree/maintainer-application)** branch (not `develop`).
2. The PR body should contain your filled-out application using the structure below.
3. Title the PR `Maintainer application: <your-github-handle>`.
4. Sign your commits with `-s` (DCO). No code changes are required — the PR body is the application.

Maintainers will review and respond in the PR. If accepted, the PR is merged. If declined or deferred, you'll receive specific feedback.

---

## Application

### About you

- **Name:** <!-- Your name, as you'd like it on MAINTAINERS.md -->
- **GitHub handle:** @
- **Discord handle (if applicable):**
- **Location / time zone:**

### Contribution history

Link your most representative merged PRs and roughly how long you've been contributing. Quality matters more than quantity.

- PR #
- PR #
- PR #

**How long have you been contributing to Cursor Boston?**

**Other relevant open source work** (optional — links to projects you maintain or contribute to elsewhere):

### Areas of interest

What part of the project would you focus your maintainer attention on? Pick one or two — maintainer load works better when responsibility is scoped.

- [ ] Frontend (`app/`, `components/`)
- [ ] Library / backend (`lib/`, API routes)
- [ ] Infrastructure (CI, deploys, security, supply chain)
- [ ] Game mode (`lib/game/`, game routes, content)
- [ ] Docs and onboarding
- [ ] Community / events (Discord, Luma, cohorts)
- [ ] Other:

**Why these areas?**

### Time commitment

Maintainers are expected to respond to issues and PRs **within one week** ([GOVERNANCE.md](GOVERNANCE.md#maintainer-responsibilities)). Roughly how much time can you commit per week?

- [ ] 1–3 hours
- [ ] 4–8 hours
- [ ] More than 8 hours

**Anything seasonal or constraint-driven** (e.g., school terms, work cycles) we should know about?

### Code-review experience

Maintainers spend most of their time reviewing PRs, not writing code. Share a link or two to PR reviews you've done — either on this repo or elsewhere — that show how you give feedback.

- Review:
- Review:

### Code of Conduct

- [ ] I have read the [Code of Conduct](CODE_OF_CONDUCT.md) and agree to uphold and enforce it in my interactions with contributors and users.

### Anything else

Optional — anything we should know that the template didn't cover.

---

## What happens after you open the PR

1. **Acknowledgement** within ~3 days: a maintainer responds to confirm the application is in review.
2. **Review** within ~2 weeks: maintainers evaluate against the criteria in [GOVERNANCE.md](GOVERNANCE.md#becoming-a-maintainer) (sustained contributions, codebase understanding, review judgment, community fit).
3. **Decision** posted in the application PR. Three possible outcomes:
   - **Accepted** — your application PR is merged on the `maintainer-application` branch. A maintainer then opens a separate `onboard/<your-handle>-maintainer` PR against `develop` with the governance update (your row added to [MAINTAINERS.md](../MAINTAINERS.md), area assignment in [CODEOWNERS](CODEOWNERS), entry in [CHANGELOG.md](../CHANGELOG.md)). When that PR merges, you are invited to the maintainer team and granted repo access.
   - **Deferred** — feedback on what additional contribution would make the case stronger; you're welcome to update and re-request review later.
   - **Declined** — feedback on why; the PR is closed but you remain welcome as a contributor.

There's no penalty for applying. The worst case is useful feedback on where to focus next.

### Audit trail

To trace any maintainer's onboarding after the fact:

- Their **application** is on the `maintainer-application` branch as a merged PR titled `Maintainer application: <handle>`.
- Their **governance update** is on `develop`/`main` as a merged PR from `onboard/<handle>-maintainer`.
- The pair is the canonical record of consent and process.
