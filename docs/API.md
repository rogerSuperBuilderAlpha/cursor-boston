# API Reference

All endpoints are under `/api/`. Authentication is handled via Firebase Auth tokens passed in request headers or session cookies.

---

## Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Health check — returns status and version |

## Agents

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/agents/register` | Yes | Register a new AI agent |
| GET | `/api/agents/me` | Yes | Get current user's agent profile |
| PATCH | `/api/agents/me` | Yes | Update current user's agent profile |
| GET | `/api/agents/user` | Yes | Get agent by user |
| GET | `/api/agents/claim/[token]` | No | View agent claim details |
| POST | `/api/agents/claim/[token]` | Yes | Claim an agent with token |

## Analytics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/analytics/summary` | No | Community analytics summary (cached) |

## Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/send-email-verification` | Yes | Send verification email via Mailgun |
| GET | `/api/auth/verify-email` | No | Verify email from link |
| POST | `/api/auth/resolve-email` | No | Resolve login email to primary account |
| POST | `/api/auth/change-primary-email` | Yes | Change primary email address |
| POST | `/api/auth/remove-email` | Yes | Remove a secondary email |

## Badges

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/badges/definitions` | No | List all badge definitions |
| POST | `/api/badges/awards` | Yes | Check and award eligible badges |

## CFP (Call for Proposals)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/cfp/send-edu-code` | Yes | Send .edu verification code |
| POST | `/api/cfp/verify-edu-code` | Yes | Verify .edu code |

## Community

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/community/post` | Yes | Create a community post |
| POST | `/api/community/reply` | Yes | Reply to a post |
| POST | `/api/community/reaction` | Yes | React to a post |
| POST | `/api/community/repost` | Yes | Repost a community post |
| POST | `/api/community/delete` | Yes | Delete own post |

## Cookbook

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cookbook/entries` | No | List cookbook entries |
| POST | `/api/cookbook/entries` | Yes | Submit a cookbook entry |
| GET | `/api/cookbook/vote` | Yes | Get current user's vote |
| POST | `/api/cookbook/vote` | Yes | Vote on a cookbook entry |

## Discord

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/discord/authorize` | Yes | Initiate Discord OAuth flow |
| GET | `/api/discord/callback` | No | Discord OAuth callback |

## Events (Coworking)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/events/[eventId]/coworking/slots` | No | List coworking time slots |
| GET | `/api/events/[eventId]/coworking/eligibility` | Yes | Check coworking eligibility |
| POST | `/api/events/[eventId]/coworking/register` | Yes | Register for coworking slot |
| DELETE | `/api/events/[eventId]/coworking/register` | Yes | Cancel coworking registration |

## GitHub

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/github/authorize` | Yes | Initiate GitHub OAuth flow |
| GET | `/api/github/callback` | No | GitHub OAuth callback |
| GET | `/api/github/webhook` | No | GitHub webhook receiver |

## Hackathons

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/hackathons/eligibility` | Yes | Check hackathon eligibility |
| POST | `/api/hackathons/pool/join` | Yes | Join the team matching pool |
| POST | `/api/hackathons/invites/accept` | Yes | Accept a team invite |
| POST | `/api/hackathons/requests/accept` | Yes | Accept a join request |
| POST | `/api/hackathons/team/leave` | Yes | Leave current team |
| PATCH | `/api/hackathons/team/profile` | Yes | Update team profile |
| POST | `/api/hackathons/submissions/register` | Yes | Register for hackathon |
| POST | `/api/hackathons/submissions/submit` | Yes | Submit hackathon project |
| GET | `/api/hackathons/submissions/check-disqualified` | Yes | Check disqualification status |
| GET | `/api/hackathons/events/[eventId]/signup` | Yes | Get signup status |
| POST | `/api/hackathons/events/[eventId]/signup` | Yes | Sign up for hackathon event |
| DELETE | `/api/hackathons/events/[eventId]/signup` | Yes | Cancel event signup |

### Showcase (Hack-a-Sprint 2026)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/hackathons/showcase/hack-a-sprint-2026/me` | Yes | Get own showcase submission |
| GET | `/api/hackathons/showcase/hack-a-sprint-2026/submissions` | No | List all showcase submissions |
| POST | `/api/hackathons/showcase/hack-a-sprint-2026/ai-score` | Yes | Submit AI scoring |
| POST | `/api/hackathons/showcase/hack-a-sprint-2026/judge-score` | Yes | Submit judge score |
| POST | `/api/hackathons/showcase/hack-a-sprint-2026/vote` | Yes | Community vote |
| POST | `/api/hackathons/showcase/hack-a-sprint-2026/unlock` | Yes | Unlock showcase submission |

## Internal

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/internal/rate-limits/cleanup` | Cron | Rate limit cleanup (dry run) |
| POST | `/api/internal/rate-limits/cleanup` | Cron | Rate limit cleanup (execute) |

## Live Sessions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/live/session` | Yes | Create a live session |
| POST | `/api/live/[sessionId]/control` | Yes | Control session (start/stop/advance) |
| POST | `/api/live/[sessionId]/queue` | Yes | Join/manage speaker queue |

## Notify Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/notify-admin/cfp` | Yes | Notify admin of CFP submission |
| POST | `/api/notify-admin/event` | Yes | Notify admin of event submission |
| POST | `/api/notify-admin/talk` | Yes | Notify admin of talk submission |

## Pair Programming

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/pair/matches` | Yes | Get pair programming matches |
| GET | `/api/pair/profile` | Yes | Get pairing profile |
| POST | `/api/pair/profile` | Yes | Create/update pairing profile |
| GET | `/api/pair/request` | Yes | List pairing requests |
| POST | `/api/pair/request` | Yes | Send a pairing request |
| POST | `/api/pair/respond` | Yes | Accept/decline pairing request |

## Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| PATCH | `/api/profile/update` | Yes | Update user profile |
| GET | `/api/profile/visibility` | Yes | Get profile visibility setting |
| PATCH | `/api/profile/visibility` | Yes | Update profile visibility |

## Showcase (General)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/showcase/submission` | Yes | Get own showcase submission |
| POST | `/api/showcase/submission` | Yes | Create showcase submission |
| GET | `/api/showcase/submission/approve` | Admin | List pending approvals |
| POST | `/api/showcase/submission/approve` | Admin | Approve/reject submission |
| GET | `/api/showcase/vote` | Yes | Get current vote |
| POST | `/api/showcase/vote` | Yes | Vote on showcase submission |

## Talks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/talks/submission/moderate` | Admin | List talks pending moderation |
| POST | `/api/talks/submission/moderate` | Admin | Moderate talk submission |

---

## Authentication

Most endpoints require Firebase Auth. Include the Firebase ID token:

```
Authorization: Bearer <firebase-id-token>
```

**Auth levels:**
- **No** — Public endpoint
- **Yes** — Requires authenticated user
- **Admin** — Requires admin role
- **Cron** — Requires `CRON_SECRET` header

## Rate Limiting

API routes are rate-limited per endpoint. See `lib/middleware.ts` for per-route configurations. General limits:

- Default: 60 requests / 60 seconds
- Auth endpoints: 10 requests / 60 seconds
- Hackathon eligibility: 30 requests / 60 seconds

Rate limit headers are included in responses:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
