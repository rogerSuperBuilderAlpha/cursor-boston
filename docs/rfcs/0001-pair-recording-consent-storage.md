---
rfc: 0001
title: Pair recording consent and storage contract
author: mrrCarter
status: draft
opened: 2026-05-23
---

# RFC-0001: Pair recording consent and storage contract

## Summary

Define the persistence, consent, storage, and API contract for turning pair
programming sessions into public recording-library entries. The first public
library slice can stay static while this RFC settles how uploads, participant
approval, transcripts, publication, and removal work.

## Motivation

Pair programming recordings can expose sensitive data: participant identities,
voices, screens, repository names, terminal output, API responses, chat text,
and accidental secrets. A public library is valuable only if contributors trust
that recordings are opt-in, reviewable, revocable before publication, and
served through controlled storage paths.

The cost of skipping the contract is high:

- A participant could be published without explicit approval.
- A recording could leak a phone number, token, customer email, private repo, or
  chat message.
- Storage URLs could become permanently public.
- Future pages and APIs could disagree on status names or ownership rules.

## Detailed design

### Current state

The existing pair programming model stores profiles, requests, and sessions in
Firestore through `lib/pair-programming/*`. A recording library first slice can
publish curated metadata, but upload and approval flows are not implemented.

### Firestore collections

Add a server-owned `sessionRecordings` collection:

```ts
interface SessionRecordingDoc {
  id: string;
  sessionId: string;
  ownerUid: string;
  participantUids: string[];
  title: string;
  summary: string;
  topics: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  durationSeconds: number;
  status:
    | "draft"
    | "awaiting_consent"
    | "ready_for_review"
    | "published"
    | "hidden"
    | "rejected"
    | "archived";
  visibility: "private" | "unlisted" | "public";
  consentVersion: number;
  requiredConsentUids: string[];
  approvedConsentUids: string[];
  revokedConsentUids: string[];
  assetRefs: RecordingAssetRef[];
  chapterRefs: RecordingChapter[];
  transcriptRef?: RecordingTranscriptRef;
  redactionNotes?: string;
  retentionDeleteAt?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  hiddenAt?: string;
}
```

Consent decisions should be append-only in
`sessionRecordingConsents/{recordingId}_{uid}_{version}`:

```ts
interface SessionRecordingConsentDoc {
  recordingId: string;
  sessionId: string;
  uid: string;
  consentVersion: number;
  decision: "approved" | "revoked";
  decidedAt: string;
}
```

Chapters can live inline on `sessionRecordings` until the list exceeds Firestore
document size limits:

```ts
interface RecordingChapter {
  startSeconds: number;
  title: string;
  summary: string;
}
```

Assets are metadata only; raw objects live in storage:

```ts
interface RecordingAssetRef {
  assetId: string;
  kind: "source-video" | "edited-video" | "thumbnail" | "caption";
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  uploadedByUid: string;
  uploadedAt: string;
}
```

### Storage paths

Use Firebase Storage unless an accepted follow-up RFC chooses another provider.
Paths should be deterministic and private by default:

```text
pair-recordings/{recordingId}/source/{assetId}
pair-recordings/{recordingId}/edited/{assetId}
pair-recordings/{recordingId}/captions/{assetId}.vtt
pair-recordings/{recordingId}/thumbnails/{assetId}
```

Do not expose raw Firebase Storage download tokens in public metadata. Public
pages should request short-lived playback or download URLs from a server route.

### API routes

Add these route contracts:

```text
GET    /api/pair/[sessionId]/recording
POST   /api/pair/[sessionId]/recording
PATCH  /api/pair/[sessionId]/recording/consent
PATCH  /api/admin/recordings/[recordingId]
GET    /api/recordings/[recordingId]/playback
```

`GET /api/pair/[sessionId]/recording`

- Participant-only.
- Returns private recording metadata for the session.
- Excludes signed playback URLs unless the requester can view the asset.

`POST /api/pair/[sessionId]/recording`

- Participant-only.
- Creates or updates a draft recording request.
- Requires a title, summary, topics, expected participant list, and asset
  manifest.
- Moves status to `awaiting_consent` when all required metadata is present.

`PATCH /api/pair/[sessionId]/recording/consent`

- Participant-only.
- Accepts `{ recordingId, consentVersion, decision }`.
- Appends a consent record, updates consent arrays, and moves the recording to
  `ready_for_review` only when every required participant has approved the same
  consent version.

`PATCH /api/admin/recordings/[recordingId]`

- Admin-only.
- Publishes, hides, rejects, or archives a recording after review.
- Publication requires `status=ready_for_review`, all required approvals, at
  least one edited video or approved metadata-only entry, and redaction review.

`GET /api/recordings/[recordingId]/playback`

- Public for published recordings, participant/admin for private recordings.
- Returns a short-lived signed URL or a 404 if the recording is not viewable.

### State transitions

```text
draft -> awaiting_consent -> ready_for_review -> published
draft -> archived
awaiting_consent -> hidden
ready_for_review -> rejected
published -> hidden
hidden -> archived
```

Rules:

- Recording is never automatic. A participant must explicitly create the
  recording request.
- Publication requires approval from all `requiredConsentUids`.
- Any participant can revoke before publication, which moves the recording back
  to `hidden` and increments `consentVersion` if it is re-opened.
- A revoke after publication hides the recording first, then requires maintainer
  review before any re-publication.
- Published entries expose only sanitized fields to public clients.

### Firestore and Storage authorization

- Client writes to `sessionRecordings` are denied. Mutations go through API
  routes with Firebase Auth.
- Participants can read private session recording metadata for sessions they are
  in.
- Public clients can read only published, sanitized metadata through API routes
  or server-rendered pages.
- Raw storage objects are private. Playback uses short-lived signed URLs.
- Admin actions require an admin custom claim and should log structured audit
  metadata.

### Redaction and review

Before publication, reviewers must check:

- API keys, Firebase tokens, cookies, and bearer tokens.
- Emails, phone numbers, street addresses, and customer identifiers.
- Private repository names, issue links, or chat messages not meant for public
  release.
- Screen-share segments that show billing, credentials, or account pages.

The implementation should store only review notes and redaction status, not raw
PII findings. Raw transcripts and source uploads remain private.

### Tests

Implementation PRs should include:

- Route tests for auth, participant authorization, invalid state transitions,
  consent-version mismatch, publish preconditions, and playback access.
- Firestore rules tests covering denied client writes and participant-only
  private reads.
- Storage rules tests or route tests proving raw object paths are not public.
- E2E smoke coverage for a participant consent flow once the UI exists.

### Migration path

The static library entries can map into `sessionRecordings` with:

- `status=published`
- `visibility=public`
- `storageStatus=metadata-only` until approved video assets exist
- `consentVersion=1`
- `approvedConsentUids=[]` only for curated seed entries with no live user ids

Future seeded entries should move to Firestore once the admin review surface
exists.

## Drawbacks

- More collection and route surface to maintain.
- Review and redaction slows down publication.
- Signed URL playback adds server cost and operational complexity.
- Participants may expect immediate publishing even though consent and redaction
  gates are required.

## Alternatives

### Do nothing

Keep the library static. This avoids sensitive-data risk but prevents community
members from submitting real recordings.

### Store public YouTube links only

This makes playback easy, but consent, takedown, redaction, and private draft
review still need a local contract. It also pushes sensitive upload handling to
an external platform before local approval.

### Make Firebase Storage objects public

Rejected. Public object URLs are hard to revoke, easy to copy, and make it
harder to guarantee that only published recordings are accessible.

### Use Vercel Blob instead of Firebase Storage

Vercel Blob may simplify deployment, but the app already uses Firebase for Auth
and Firestore. Firebase Storage keeps auth, audit, and object ownership closer
to the existing platform until there is a measured reason to switch.

## Unresolved questions

- TBD - owner input required: final storage provider and budget limit.
- TBD - owner input required: maximum upload size and accepted video formats.
- TBD - owner input required: retention period for hidden, rejected, and source
  recordings.
- TBD - owner input required: whether transcripts are generated manually or by a
  vendor service.
- TBD - owner input required: who owns redaction review and takedown SLA.

## Future possibilities

- Community search over transcripts after redaction.
- Chapter-level clips for showcase pages.
- Badge credit for approved educational recordings.
- Moderation queue shared with other community content surfaces.

---

## Implementation checklist (filled in after acceptance)

- [ ] Tracking issue opened
- [ ] Implementation PR(s):
  - [ ] PR #
- [ ] CHANGELOG entry added
- [ ] Corresponding ADR written in [`../adr/`](../adr/README.md)
- [ ] Cross-linked from this RFC's frontmatter (`implemented:` + `adr:`)
- [ ] User-facing docs updated (if applicable)
