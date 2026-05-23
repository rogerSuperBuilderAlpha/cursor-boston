# Monthly Challenge Contract

Status: Draft
Tracking issue: [#256](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/256)

## Summary

The monthly challenge hub can start as a public seeded archive. This contract
defines the follow-up persistence layer for member submissions, judging,
community voting, scoring, and winner publication.

The goals are:

- Let signed-in members submit challenge entries.
- Keep submissions private until the challenge owner opens voting or publishes
  winners.
- Support deterministic rubric scoring.
- Prevent duplicate, late, or abusive votes.

## Firestore collections

### `monthlyChallenges/{challengeId}`

```ts
interface MonthlyChallengeDoc {
  id: string;
  slug: string;
  monthLabel: string;
  title: string;
  summary: string;
  prompt: string;
  status: "draft" | "open" | "judging" | "published" | "archived";
  submissionOpenAt: string;
  submissionCloseAt: string;
  votingOpenAt?: string;
  votingCloseAt?: string;
  maxLines: number;
  rubric: ChallengeRubricItem[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}
```

### `monthlyChallengeSubmissions/{submissionId}`

```ts
interface MonthlyChallengeSubmissionDoc {
  id: string;
  challengeId: string;
  ownerUid: string;
  title: string;
  summary: string;
  repositoryUrl?: string;
  demoUrl?: string;
  writeup: string;
  cursorWorkflow: string;
  status:
    | "draft"
    | "submitted"
    | "needs_changes"
    | "eligible"
    | "ineligible"
    | "winner"
    | "withdrawn";
  reviewNote?: string;
  scoreTotal?: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  publishedAt?: string;
}
```

### `monthlyChallengeScores/{submissionId}_{judgeUid}`

```ts
interface MonthlyChallengeScoreDoc {
  challengeId: string;
  submissionId: string;
  judgeUid: string;
  rubricScores: Array<{
    label: string;
    pointsAwarded: number;
    maxPoints: number;
    note?: string;
  }>;
  total: number;
  createdAt: string;
  updatedAt: string;
}
```

### `monthlyChallengeVotes/{challengeId}_{submissionId}_{uid}`

```ts
interface MonthlyChallengeVoteDoc {
  challengeId: string;
  submissionId: string;
  uid: string;
  value: 1;
  createdAt: string;
  updatedAt: string;
}
```

Start with upvotes only. A later change can add ranked-choice or categories if
the community needs more nuance.

## API routes

```text
GET    /api/challenges
GET    /api/challenges/[challengeId]
POST   /api/challenges/[challengeId]/submissions
PATCH  /api/challenges/[challengeId]/submissions/[submissionId]
POST   /api/challenges/[challengeId]/submissions/[submissionId]/submit
POST   /api/challenges/[challengeId]/submissions/[submissionId]/vote
POST   /api/admin/challenges/[challengeId]/submissions/[submissionId]/review
POST   /api/admin/challenges/[challengeId]/submissions/[submissionId]/score
```

### `GET /api/challenges`

- Public.
- Returns published or open challenges with sanitized submission counts.
- Does not return private draft challenges.

### `GET /api/challenges/[challengeId]`

- Public for open, judging, published, or archived challenges.
- Returns eligible/published submissions only when voting or results are public.
- Owners can fetch their own draft/submitted entries through authenticated
  context.

### `POST /api/challenges/[challengeId]/submissions`

- Signed-in members only.
- Challenge must be `open`.
- Creates a draft submission for the requester.
- Enforces one active submission per user per challenge unless admins approve a
  reset.

### `PATCH /api/challenges/[challengeId]/submissions/[submissionId]`

- Owner-only while status is `draft` or `needs_changes`.
- Validates URLs, writeup length, and required Cursor workflow note.

### `POST /api/challenges/[challengeId]/submissions/[submissionId]/submit`

- Owner-only.
- Requires challenge submission window to still be open.
- Moves status to `submitted` and records `submittedAt`.

### `POST /api/challenges/[challengeId]/submissions/[submissionId]/vote`

- Signed-in members only.
- Voting window must be open.
- Submission must be `eligible`.
- One idempotent upvote per user per submission.
- Owners cannot vote for their own submission.

### Admin review and scoring

`POST /api/admin/challenges/[challengeId]/submissions/[submissionId]/review`

- Admin or challenge judge only.
- Sets `eligible`, `ineligible`, or `needs_changes`.
- Stores a review note for the owner when action is not `eligible`.

`POST /api/admin/challenges/[challengeId]/submissions/[submissionId]/score`

- Admin or challenge judge only.
- Validates rubric labels and point caps.
- Upserts one score per judge per submission.
- Recomputes aggregate `scoreTotal`.

## Authorization model

- API routes perform writes with Firebase Admin SDK.
- Direct client writes to challenge collections are denied.
- Public clients read only sanitized challenge and published submission fields.
- Owners can read and edit their own draft/submitted entries.
- Judges can read submitted entries during review and judging.
- Admins can manage challenge status and winner publication.

## Visibility rules

- Draft submissions are visible only to owners.
- Submitted entries are visible to owners and reviewers.
- Eligible entries can become public when voting opens.
- Winner entries remain public after results are published.
- Withdrawn and ineligible entries are not public.

## Scoring and winner publication

The public winner order should be deterministic:

1. Higher judge `scoreTotal`.
2. Higher community vote count.
3. Earlier `submittedAt`.
4. Title ascending as a stable tie-breaker.

Community votes should not override rubric scoring; they are a secondary signal.

## Abuse controls

- Rate-limit submissions, votes, and admin review routes.
- Validate GitHub/demo URLs against safe protocols.
- Block self-votes.
- Keep review notes private unless explicitly published by admins.
- Allow admins to hide an eligible submission if a link starts serving unsafe
  content after review.

## Implementation test plan

Implementation PRs should include:

- Unit tests for challenge window checks and winner ordering.
- API route tests for auth, one-submission rule, late submission rejection,
  owner-only edits, self-vote rejection, idempotent votes, and scoring point
  caps.
- Firestore rules tests proving direct client writes are denied.
- Public page tests for draft vs voting vs published visibility.

## Migration from seeded challenges

The seeded challenge hub can migrate each challenge with:

- `status="open"` for the current challenge
- `status="archived"` for previous challenges
- Empty submission, vote, and score collections
- Rubric copied from the seeded data module

Until the migration lands, the public pages may continue to read the seeded
module.

## Unresolved questions

- TBD - owner input required: who can be a challenge judge.
- TBD - owner input required: whether members can edit after submission.
- TBD - owner input required: whether team submissions are allowed.
- TBD - owner input required: whether public voting is anonymous or displays
  voter counts only.
- TBD - owner input required: prize/winner announcement workflow.

## Follow-up PR sequence

1. Add shared challenge schemas and window helper tests.
2. Add submission and vote API routes with route tests.
3. Add Firestore rules tests.
4. Add signed-in submission UI.
5. Add judging/admin review UI.
