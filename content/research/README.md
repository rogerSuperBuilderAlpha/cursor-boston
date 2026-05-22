# Cursor Boston — Research

This directory powers the **/research** page on cursorboston.com — a
community space where academic researchers can:

- **Recruit participants** for studies (compensated, IRB-approved).
- **Share pre-prints** and working theory papers for community discussion.
- **Publish datasets** for the community to explore, cite, or build on.

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
timestamp. For preprints, also bump `version`. For recruiting entries,
update `slotsRemaining` or `status` as the study progresses; set `status`
to `"closed"` when complete.

## JSON schema

Every entry shares a base + adds type-specific fields. The full Zod schema
lives in [`lib/research.ts`](../../lib/research.ts) and is the source of
truth — the listing here is for convenience. Validation runs at build
time; a malformed entry breaks the build, not the page.

### Shared (every entry)

```jsonc
{
  "slug": "kebab-case-slug",            // matches filename, lowercase
  "type": "recruiting" | "preprint" | "dataset",
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
  "contactUrl": "https://forms.gle/..."      // or contactUrl (or both)
}
```

### `type: "recruiting"` — add

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

### `type: "preprint"` — add

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

## Anti-patterns (please don't)

- **Don't host paper PDFs or large dataset files in this repo.** Use your
  source repo, Zenodo, OSF, arXiv, etc. This repo only holds the metadata.
- **Don't lead with compensation** in recruiting summaries — lead with the
  research question. Cursor Boston is a community, not a marketplace.
- **Don't post entries without a license** for preprints or datasets.
  Without a license, others cannot legally reuse the work.
- **Don't omit `deadline` on recruiting entries.** Past-deadline studies
  auto-strike and auto-hide so the feed stays alive.
- **Don't open multiple entries for the same study.** Update the existing
  entry instead.

## Moderation

Maintainers reserve the right to close PRs that don't meet the schema, are
off-topic for an academic-research surface, or post personal data of
participants. If your entry is removed and you think it was in error, open
an issue.
