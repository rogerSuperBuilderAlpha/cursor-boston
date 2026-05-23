# Prompt Template Library Contract

Status: Draft
Tracking issue: [#255](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/255)

## Summary

The prompt template library starts as a public seeded gallery. This contract
defines the follow-up persistence layer for member-submitted templates,
stack-specific variants, moderation, voting, and forking.

The goals are:

- Let signed-in members submit reusable Cursor prompt templates.
- Let members add stack-specific variants without duplicating the whole
  template.
- Keep public pages fast and safe by publishing only moderated, sanitized data.
- Preserve a small API surface that can be tested independently.

## Terms

- Template: the canonical reusable prompt and metadata.
- Variant: a stack-specific adaptation of a template, such as Next.js with
  Firebase or Python with Django.
- Placeholder: a named token in the prompt body, written as
  `{{placeholder_name}}`.
- Fork: a private copy a member can customize before submitting a variant.
- Published: visible on public `/templates` pages.

## Firestore collections

### `promptTemplates/{templateId}`

```ts
interface PromptTemplateDoc {
  id: string;
  slug: string;
  ownerUid: string;
  title: string;
  summary: string;
  category: string;
  useCase: string;
  prompt: string;
  placeholders: PromptTemplatePlaceholder[];
  tags: string[];
  moderationStatus:
    | "draft"
    | "pending_review"
    | "published"
    | "hidden"
    | "rejected"
    | "archived";
  visibility: "private" | "unlisted" | "public";
  voteScore: number;
  variantCount: number;
  forkCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  hiddenAt?: string;
  rejectionReason?: string;
}
```

### `promptTemplateVariants/{variantId}`

```ts
interface PromptTemplateVariantDoc {
  id: string;
  templateId: string;
  ownerUid: string;
  title: string;
  summary: string;
  stack: {
    language?: string;
    framework?: string;
    database?: string;
    authProvider?: string;
    deployment?: string;
  };
  prompt: string;
  placeholderOverrides: PromptTemplatePlaceholder[];
  moderationStatus:
    | "draft"
    | "pending_review"
    | "published"
    | "hidden"
    | "rejected"
    | "archived";
  visibility: "private" | "unlisted" | "public";
  voteScore: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  hiddenAt?: string;
  rejectionReason?: string;
}
```

### `promptTemplateVotes/{targetType}_{targetId}_{uid}`

```ts
interface PromptTemplateVoteDoc {
  targetType: "template" | "variant";
  targetId: string;
  uid: string;
  value: 1;
  createdAt: string;
  updatedAt: string;
}
```

Start with upvotes only. Downvotes can be added later if abuse handling and
ranking rules need them.

### Shared placeholder shape

```ts
interface PromptTemplatePlaceholder {
  name: string;
  label: string;
  description: string;
  required: boolean;
  example: string;
}
```

Placeholder names must match `^[a-z][a-z0-9_]{1,48}$`. The rendered preview
replaces placeholders as text only. It must not evaluate code or HTML.

## API routes

```text
GET    /api/templates
POST   /api/templates
GET    /api/templates/[templateId]
PATCH  /api/templates/[templateId]
POST   /api/templates/[templateId]/variants
PATCH  /api/templates/[templateId]/variants/[variantId]
POST   /api/templates/[templateId]/vote
POST   /api/templates/[templateId]/fork
PATCH  /api/admin/templates/[templateId]
```

### `GET /api/templates`

- Public.
- Returns published templates with published variant counts.
- Supports filters for `category`, `tag`, `stack`, and `q`.
- Does not return private drafts, owner uid email data, rejection notes, or
  moderation internals.

### `POST /api/templates`

- Signed-in members only.
- Creates a private `draft` template owned by the requester.
- Validates prompt length, placeholders, title, category, and tags.
- Moves to `pending_review` only when the request includes
  `submitForReview=true`.

### `PATCH /api/templates/[templateId]`

- Owner-only while the template is `draft`, `hidden`, or `rejected`.
- Published templates cannot be edited in place. Edits create a private draft
  revision for later review.

### `POST /api/templates/[templateId]/variants`

- Signed-in members only.
- Parent template must be published.
- Creates a variant draft and can submit it for review.
- Variant placeholders must include every required placeholder from the parent
  template unless the parent placeholder is explicitly deprecated.

### `PATCH /api/templates/[templateId]/variants/[variantId]`

- Owner-only while variant is `draft`, `hidden`, or `rejected`.
- Published variants follow the same revision rule as templates.

### `POST /api/templates/[templateId]/vote`

- Signed-in members only.
- One upvote per user per template or variant.
- Idempotent: a repeated upvote returns the existing vote.
- Removing a vote can be added as `DELETE` in the implementation PR if the UI
  needs it.

### `POST /api/templates/[templateId]/fork`

- Signed-in members only.
- Creates a private draft copy owned by the requester.
- The fork stores `sourceTemplateId` and optional `sourceVariantId`.
- Forks do not affect public ranking until submitted and published.

### `PATCH /api/admin/templates/[templateId]`

- Admin-only.
- Publishes, hides, rejects, or archives a template or variant.
- Publish requires validation, moderation review, and placeholder consistency.
- Hide is used for policy violations, stale unsafe prompts, or author request.

## Moderation and safety

Public templates must not include:

- Secrets, tokens, private repository URLs, or customer identifiers.
- Instructions to exfiltrate data or bypass access controls.
- Harassment, doxxing, or discriminatory content.
- Prompts that ask members to paste private credentials into third-party tools.

Moderation should reuse existing platform logging and auth patterns. If an
automated safety helper is added later, it must be advisory. Admin publication
remains the source of truth for the first implementation.

## Firestore authorization model

- API routes perform all writes with Firebase Admin SDK.
- Client-side direct writes to template collections are denied.
- Public clients can read published, sanitized records through API routes or
  server-rendered pages.
- Owners can read their private drafts through authenticated API routes.
- Admins can read moderation fields through admin-only API routes.

## Ranking

Initial ranking should be deterministic:

1. Published templates with higher `voteScore`.
2. More published variants.
3. Newer `publishedAt`.
4. Title ascending as a stable tie-breaker.

Do not rank private drafts or rejected content.

## Implementation test plan

Implementation PRs should include:

- API route tests for auth, create, validation failures, submit for review,
  owner-only edits, variant parent checks, voting idempotency, and admin publish
  preconditions.
- Firestore rules tests proving direct client writes are denied.
- Unit tests for placeholder parsing and ranking.
- Page tests or focused integration tests for public filtering once the API is
  wired into the UI.

## Migration from seeded templates

The seeded public templates can migrate to Firestore as:

- `ownerUid="system"`
- `moderationStatus="published"`
- `visibility="public"`
- `voteScore=0`
- `variantCount` derived from seeded variants

Until the migration lands, public pages may keep reading from the static data
module introduced by the first library slice.

## Unresolved questions

- TBD - owner input required: maximum prompt length.
- TBD - owner input required: whether anonymous public author display is
  allowed.
- TBD - owner input required: moderation SLA and reviewer role.
- TBD - owner input required: whether downvotes are needed for ranking.
- TBD - owner input required: plagiarism or attribution policy for forks.

## Follow-up PR sequence

1. Add shared Zod schemas and placeholder parser tests.
2. Add Firestore-backed API routes with route tests.
3. Add Firestore rules tests.
4. Wire public pages to the API-backed source.
5. Add signed-in submission and variant forms.
