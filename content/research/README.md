# Cursor Boston — Research

This directory powers the **/research** page on cursorboston.com — a
community space where academic researchers can:

- **Recruit participants** for active studies (compensated, IRB-approved).
- **Share working papers** for community discussion.
- **Publish datasets** for the community to explore, cite, or build on.
- **Find collaborators** — co-authors, replication partners, grant
  co-investigators, data-sharing arrangements.
- **Post calls for papers** — upcoming conferences, journal special
  issues, workshops.

Everything here is community-curated through GitHub. **There is no in-app
form, no Firestore record, no login required.** A research entry exists if
and only if there is a JSON file in `content/research/entries/` on `main`.

## How submissions work

1. Fork [`rogerSuperBuilderAlpha/cursor-boston`](https://github.com/rogerSuperBuilderAlpha/cursor-boston).
2. Create your external "source repo" — a GitHub repository **you own** that
   holds the actual content (paper PDFs, dataset files, study materials,
   participant-recruitment landing page, etc.). The entry in this repo only
   points to your source repo; it does not host the content itself. This
   keeps Cursor Boston as the discovery layer and leaves authorship,
   licensing, and updates with the researcher.
3. Add a single new file at `content/research/entries/<your-slug>.json`
   following the schema below. The filename's slug must match the `slug`
   field in the JSON.
4. Open a pull request against `develop`. Reviewers will check the schema,
   make sure the source repo is reachable, and merge.
5. After the next `develop → main` release, your entry appears on
   cursorboston.com/research.

**Discussion of any entry happens via pull-request comments**, either on
your entry's JSON file in this repo or as issues / PRs on your external
source repo. The detail page links out to both.

## Editing an existing entry

PR an update to the JSON file. Bump `updatedAt` to the current ISO
timestamp. For working papers, also bump `version`. For active-research
entries, update `slotsRemaining` or `status` as the study progresses; set
`status` to `"closed"` when complete. For CFP entries, set `status` to
`"closed"` once the deadline passes (or rely on the 21-day auto-hide).

## JSON schema

Every entry shares a base + adds type-specific fields. The full Zod schema
lives in [`lib/research.ts`](../../lib/research.ts) and is the source of
truth — the listing here is for convenience. Validation runs at build
time; a malformed entry breaks the build, not the page.

### Shared (every entry)

```jsonc
{
  "slug": "kebab-case-slug",            // matches filename, lowercase
  "type": "active-research" | "working-paper" | "dataset" | "collaboration" | "cfp",
  "title": "Short human title",
  "authors": [
    { "name": "Full Name", "affiliation": "University / Lab", "url": "https://..." }
  ],
  "postedAt": "2026-05-22T13:00:00-04:00",  // ISO with offset
  "updatedAt": "2026-05-22T13:00:00-04:00", // optional; bump on edits
  "disciplines": ["HCI", "developer-tools"], // 1-8 tags
  "summary": "Two-sentence description that appears on the card.",
  "sourceRepoUrl": "https://github.com/<you>/<your-repo>",
  "contactEmail": "you@university.edu",      // either contactEmail
  "contactUrl": "https://forms.gle/...",     // or contactUrl (or both)
  "isSample": true                            // omit on real entries
}
```

> The `isSample` flag is for **placeholder / demo entries only**.
> Sample entries are hidden from the main feed and from type-specific
> filters; they only appear under the dedicated "Samples" filter, and
> their external CTAs are visually disabled so visitors don't click
> through to fake URLs. Maintainers set this on seed data; real
> submissions should not include it.

### `type: "active-research"` — add

For studies currently recruiting participants.

```jsonc
{
  "deadline": "2026-06-30T23:59:00-04:00",    // REQUIRED — past-deadline auto-strikes; auto-hides after 14 days
  "compensation": "$25 Amazon gift card",
  "timeCommitment": "45 minutes",
  "location": "remote" | "in-person" | "hybrid",
  "eligibility": "One-line summary of who qualifies.",
  "slotsRemaining": 28,                       // optional
  "irb": {                                    // optional but strongly encouraged
    "institution": "Bentley University",
    "protocolNumber": "IRB-2026-XYZ"
  },
  "studyUrl": "https://qualtrics...",         // optional — link to the actual study
  "status": "open" | "paused" | "closed"      // optional, defaults to "open"
}
```

### `type: "working-paper"` — add

For pre-prints, drafts, and theory papers open to community feedback
before formal peer review.

```jsonc
{
  "version": "v1",                            // bump on revisions
  "license": "CC-BY-4.0",                     // your license; required
  "pdfUrl": "https://your-repo/.../paper.pdf",
  "doi": "10.31234/osf.io/xyz",               // optional
  "peerReviewStatus": "awaiting" | "approved" | "approved-with-reservations" | "rejected"
}
```

### `type: "dataset"` — add

```jsonc
{
  "license": "CC-BY-4.0",                     // REQUIRED
  "size": "1.2M rows · 480 MB",               // optional, free text
  "format": ["CSV", "Parquet"],               // optional, 1-8 entries
  "doi": "10.5281/zenodo.123456",             // optional
  "citation": "Author, A. (2026). Dataset name. Zenodo. doi:10.5281/zenodo.123456"
}
```

### `type: "collaboration"` — add

For requests to find peer collaborators — co-authors, co-investigators,
replication partners, data-sharing arrangements, code-collaboration,
grant partners.

```jsonc
{
  "collaborationType": "co-author" | "co-investigator" | "replication-partner" | "data-sharing" | "code-collaboration" | "grant-partner" | "other",
  "projectStage": "idea" | "proposal" | "data-collection" | "analysis" | "writing" | "revising",
  "seeking": "Plain-language description of the skills / expertise / commitment you're looking for.",
  "timeCommitment": "~10 hr/week × 8 weeks",
  "deadline": "2026-07-15T23:59:00-04:00",    // optional — grant deadline, conference target, etc.
  "status": "open" | "paused" | "closed"      // optional, defaults to "open"
}
```

### `type: "cfp"` — add

For upcoming conferences, journal special issues, and workshops. (Cursor
Boston's own flagship CFP has a dedicated banner on the page; this type
is for peer / external CFPs.)

```jsonc
{
  "conferenceDates": "April 25–29, 2027",      // free-text date range; ok to say "TBD"
  "location": "Yokohama, Japan (hybrid)",      // "City, Country" or "Virtual" or "Hybrid — ..."
  "submissionDeadline": "2026-12-15T23:59:00-05:00", // REQUIRED — auto-strikes when past; auto-hides 21 days later
  "conferenceUrl": "https://chi2027.acm.org/...",
  "organizingBody": "ACM SIGCHI",
  "submissionTypes": ["Full paper", "Poster", "Workshop position paper"],
  "status": "open" | "paused" | "closed"       // optional, defaults to "open"
}
```

## Anti-patterns (please don't)

- **Don't host paper PDFs or large dataset files in this repo.** Use your
  source repo, Zenodo, OSF, arXiv, etc. This repo only holds the metadata.
- **Don't lead with compensation** in active-research summaries — lead
  with the research question. Cursor Boston is a community, not a
  marketplace.
- **Don't post entries without a license** for working papers or
  datasets. Without a license, others cannot legally reuse the work.
- **Don't omit `deadline` on active-research entries or
  `submissionDeadline` on CFPs.** Past-deadline entries auto-strike and
  auto-hide so the feed stays alive.
- **Don't open multiple entries for the same study / paper / CFP.**
  Update the existing entry instead.
- **Don't post personal CFPs through this surface that you yourself
  organize as a stand-alone banner.** The page banner is for the
  community's flagship CFP; the `cfp` type is for sharing other people's
  conferences.

## Moderation

Maintainers reserve the right to close PRs that don't meet the schema, are
off-topic for an academic-research surface, or post personal data of
participants. If your entry is removed and you think it was in error, open
an issue.
