# Skills Passport Contract

Status: Draft
Tracking issue: [#252](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/252)

## Summary

The Skills Passport dashboard can initially derive progress from existing badge
and profile data. This contract defines the follow-up persistence layer for
member skill progress, evidence submissions, stamped skill cards, and
mentor/admin verification.

The goals are:

- Track AI-assisted development skill progress without replacing the badge
  system.
- Let members submit evidence for a skill milestone.
- Let mentors or admins verify evidence and issue skill cards.
- Keep public credential data minimal and privacy-preserving.

## Relationship to badges

Badges remain the broad recognition system. Skills Passport adds structured
progress inside skill tracks such as AI debugging, prompt engineering, safe
refactoring, multi-file generation, and review workflow.

Existing badge eligibility can seed progress, but verified skill cards should be
their own records so they can include verifier, evidence, level, expiration, and
revocation metadata.

## Firestore collections

### `userSkills/{uid}_{skillId}`

```ts
interface UserSkillDoc {
  uid: string;
  skillId: string;
  trackId: string;
  level: "started" | "practiced" | "verified" | "mentor";
  progressPercent: number;
  sourceBadges: string[];
  verifiedCardIds: string[];
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}
```

### `skillEvidence/{evidenceId}`

```ts
interface SkillEvidenceDoc {
  id: string;
  uid: string;
  skillId: string;
  trackId: string;
  title: string;
  summary: string;
  url?: string;
  relatedPrNumber?: number;
  relatedChallengeId?: string;
  status:
    | "draft"
    | "submitted"
    | "needs_changes"
    | "verified"
    | "rejected"
    | "withdrawn";
  reviewerUid?: string;
  reviewerNote?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedAt?: string;
}
```

### `skillCards/{cardId}`

```ts
interface SkillCardDoc {
  id: string;
  uid: string;
  skillId: string;
  trackId: string;
  level: "verified" | "mentor";
  evidenceId: string;
  verifierUid: string;
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  revokeReason?: string;
  publicSlug: string;
}
```

### `skillVerificationEvents/{eventId}`

```ts
interface SkillVerificationEventDoc {
  id: string;
  evidenceId: string;
  cardId?: string;
  actorUid: string;
  targetUid: string;
  action:
    | "submitted"
    | "requested_changes"
    | "verified"
    | "rejected"
    | "revoked";
  note?: string;
  createdAt: string;
}
```

`skillVerificationEvents` is append-only and is the audit trail for reviewer
actions.

## Static skill catalog

The skill catalog should stay in code until member-created skills are approved.
Each catalog entry needs:

```ts
interface SkillCatalogItem {
  id: string;
  trackId: string;
  title: string;
  description: string;
  levels: Array<"started" | "practiced" | "verified" | "mentor">;
  evidenceRequirements: string[];
  relatedBadgeIds: string[];
}
```

This keeps the first implementation deterministic and avoids a new admin UI for
skill definitions.

## API routes

```text
GET    /api/skills/progress
POST   /api/skills/evidence
PATCH  /api/skills/evidence/[evidenceId]
POST   /api/skills/evidence/[evidenceId]/submit
POST   /api/skills/verify
POST   /api/skills/cards/[cardId]/revoke
GET    /api/skills/cards/[publicSlug]
```

### `GET /api/skills/progress`

- Signed-in members only.
- Returns derived progress from `userSkills`, verified cards, and existing
  badge eligibility.
- Does not expose reviewer notes for other members.

### `POST /api/skills/evidence`

- Signed-in members only.
- Creates a draft evidence record for the requester.
- Validates `skillId`, summary length, URL safety, and related PR/challenge
  references.

### `PATCH /api/skills/evidence/[evidenceId]`

- Owner-only while evidence is `draft` or `needs_changes`.
- Reviewer notes cannot be edited by the owner.

### `POST /api/skills/evidence/[evidenceId]/submit`

- Owner-only.
- Moves evidence from `draft` or `needs_changes` to `submitted`.
- Appends a `submitted` verification event.

### `POST /api/skills/verify`

- Mentor/admin only.
- Accepts `evidenceId`, `decision`, and optional note.
- `decision=verified` creates a `skillCards` record and updates `userSkills`.
- `decision=needs_changes` or `decision=rejected` stores the reviewer note on
  evidence and appends an event.

### `POST /api/skills/cards/[cardId]/revoke`

- Admin-only for the first implementation.
- Marks the card revoked, updates `userSkills`, and appends a revoke event.

### `GET /api/skills/cards/[publicSlug]`

- Public.
- Returns only public credential fields: skill title, level, issue date,
  expiration, revocation state, and member display name if the member profile is
  public.

## Authorization model

- API routes perform writes with Firebase Admin SDK.
- Direct client writes to `userSkills`, `skillEvidence`, `skillCards`, and
  verification events are denied.
- Owners can read their own private evidence.
- Reviewers can read submitted evidence while reviewing.
- Public credential reads expose only sanitized skill-card fields.
- Mentor/admin authorization should use existing custom-claim or maintainer
  patterns; do not rely on client-provided role names.

## Privacy and abuse controls

Evidence can include personal repositories, screenshots, or links. The first
implementation should:

- Store URLs, not uploaded files.
- Warn members not to submit secrets, private customer data, or private repo
  links they cannot share.
- Let members withdraw draft/submitted evidence.
- Keep rejected evidence private to the member and reviewers.
- Publish only skill cards, not full evidence text, unless the member opts in.

## Progress calculation

Progress should use deterministic inputs:

1. Skill catalog requirements.
2. Existing badge eligibility and awarded badges.
3. Verified skill cards.
4. Submitted evidence state.

Manual progress edits are not allowed. If a correction is needed, issue or
revoke a skill card.

## Implementation test plan

Implementation PRs should include:

- Unit tests for progress calculation from badges, evidence, and cards.
- API route tests for auth, owner-only edits, invalid skill ids, submit
  transitions, reviewer decisions, and revocation.
- Firestore rules tests proving direct client writes are denied.
- Public credential route tests for private profile and revoked-card behavior.

## Migration from the dashboard slice

The dashboard can continue reading existing badge-derived data until the API is
ready. Migration should map existing awarded badges into `sourceBadges` and
leave `verifiedCardIds` empty until a reviewer issues cards.

## Unresolved questions

- TBD - owner input required: which roles count as mentor reviewers.
- TBD - owner input required: whether verified skill cards expire.
- TBD - owner input required: public display format for skill cards.
- TBD - owner input required: whether members can request verifier assignment.
- TBD - owner input required: evidence retention after withdrawal.

## Follow-up PR sequence

1. Add skill catalog and progress calculation tests.
2. Add evidence and card API schemas.
3. Add Firestore-backed API routes and route tests.
4. Add Firestore rules tests.
5. Wire `/skills` to the API-backed progress source.
